import { type Preset, type PresetConfig } from "$lib"
import sqlite3 from "sqlite3"
import { ulid } from "ulid"
import logger from '$lib/server/logger'
import type { Project, Chat, ChatMessage, Dataset, ChatMessageContent } from "$lib"
import { DefaultProject, DefaultPreset } from "$lib"
import { type ToolCall as OllamaToolCall } from "ollama"

export enum EntityType {
    Project = 'p',
    Chat = 'c',
    ChatMessage = 'cm',
    Preset = 'pr',
    Dataset = 'd'
}

class IdGen {
    static generate(entity: EntityType): string {
        return `${entity}_${ulid()}`
    }
}

export class DbService {
    private db: sqlite3.Database
    private dbFileName: string = "playground.db"

    constructor() {
        this.db = new sqlite3.Database(this.dbFileName);
        this.db.on('trace', (sql) => {
            logger.info({ message: 'SQL', sql: sql })
        })
    }

    async init() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)
            this.db.run(`INSERT INTO projects (id, name) VALUES (?, ?) ON CONFLICT DO NOTHING`, [DefaultProject.id, DefaultProject.name])
            this.db.run(`
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY, 
                    project_id TEXT,
                    title TEXT NULL,
                    system_prompt TEXT NULL,
                    golden BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(project_id) REFERENCES projects(id)
                )
            `);
            this.db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY, 
                    chat_id TEXT NOT NULL, 
                    message_seq_num INTEGER NOT NULL,
                    message JSON NOT NULL,
                    model TEXT NOT NULL, 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                    FOREIGN KEY(chat_id) REFERENCES chats(id),
                    FOREIGN KEY(model) REFERENCES models(name)
                )
            `);
            this.db.run(`
                CREATE TABLE IF NOT EXISTS models (
                    name TEXT PRIMARY KEY,
                    params BLOB
                )
            `)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS presets (    
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    preset JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS datasets (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(project_id) REFERENCES projects(id)
                )
            `)
            this.db.run("PRAGMA foreign_keys = ON");
        });
    }

    private makeChat(row: any): Chat {
        return {
            id: row.id,
            projectId: row.project_id,
            title: row.title,
            systemPrompt: row.system_prompt,
            golden: row.golden,
            createdAt: row.created_at,
        };
    }

    private makeChatMessage(row: any): ChatMessage {
        return {
            id: row.id,
            chatId: row.chat_id,
            messageSeqNum: row.message_seq_num,
            message: JSON.parse(row.message),
            model: row.model,
            createdAt: row.created_at,
        };
    }

    async createChat(projectId: string, systemPrompt: string | null = null): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = IdGen.generate(EntityType.Chat)
            this.db.run("INSERT INTO chats (id, project_id, system_prompt) VALUES (?, ?, ?)", [id, projectId, systemPrompt], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async getChat(chatId: string): Promise<Chat | null> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM chats WHERE id = ?", [chatId], (err, row: any) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve(this.makeChat(row));
                }
            });
        })
    }

    async updateChat(chatId: string, chat: Partial<Chat>): Promise<void> {
        return new Promise((resolve, reject) => {
            const clauses = []
            const params = []
            if (chat.title !== undefined) {
                clauses.push("title = ?")
                params.push(chat.title)
            }
            if (chat.systemPrompt !== undefined) {
                clauses.push("system_prompt = ?")
                params.push(chat.systemPrompt)
            }
            if (chat.golden !== undefined) {
                clauses.push("golden = ?")
                params.push(chat.golden)
            }
            params.push(chatId)
            const clauseStr = clauses.join(", ")
            this.db.run(`UPDATE chats SET ${clauseStr} WHERE id = ?`, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async listChats(projectId: string, golden?: boolean, offset: number = 0, limit: number = 50): Promise<Chat[]> {
        const whereClauses = ["project_id = ?"]
        const params: any[] = [projectId]

        if (golden !== undefined) {
            whereClauses.push("golden = ?")
            params.push(golden)
        }
        params.push(limit)
        params.push(offset)

        const query = `SELECT * FROM chats WHERE ${whereClauses.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        logger.info({ message: 'Listing chats query', query, params })

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const chats = rows.map(this.makeChat);
                    resolve(chats);
                }
            });
        });
    }

    async deleteChat(chatId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run("DELETE FROM messages WHERE chat_id = ?", [chatId]);
                this.db.run("DELETE FROM chats WHERE id = ?", [chatId], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            })
        })
    }

    async getMessages(chatId: string): Promise<ChatMessage[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM messages WHERE chat_id = ?", [chatId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const messages = rows.map(this.makeChatMessage);
                    resolve(messages);
                }
            });
        });
    }

    async getMessagesBatch(chatIds: string[]): Promise<ChatMessage[][]> {
        const placeholders = chatIds.map(() => '?').join(',');
        const sql = `SELECT * FROM messages WHERE chat_id IN (${placeholders}) ORDER BY created_at`;
        return new Promise((resolve, reject) => {
            this.db.all(sql, chatIds, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const messages = rows.map(this.makeChatMessage);
                    const messagesByChatId = chatIds.map(chatId => messages.filter(message => message.chatId === chatId));
                    resolve(messagesByChatId);
                }
            });
        });
    }

    private async getNextMessageSeqNum(chatId: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT MAX(message_seq_num) as max_seq_num FROM messages WHERE chat_id = ?", [chatId], (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    if (!row) {
                        resolve(1);
                    } else {
                        resolve(row.max_seq_num + 1);
                    }
                }
            });
        });
    }

    async addMessage(chatId: string, model: string, message: ChatMessageContent): Promise<string> {
        const messageSeqNum = await this.getNextMessageSeqNum(chatId)
        const messageId = IdGen.generate(EntityType.ChatMessage)
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT INTO messages (id, chat_id, message_seq_num, message, model) VALUES (?, ?, ?, ?, ?)", 
                [messageId, chatId, messageSeqNum, JSON.stringify(message), model], 
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(messageId);
                    }
                }
            );
        });
    }

    async getMessage(messageId: string): Promise<ChatMessage> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM messages WHERE id = ?", [messageId], (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.makeChatMessage(row));
                }
            });
        });
    }

    async updateMessage(chatId: string, messageId: string, content: Partial<ChatMessageContent>): Promise<void> {
        const chatMessage = await this.getMessage(messageId)
        const currMessageContent: ChatMessageContent = chatMessage.message
        const updatedMessage = { ...currMessageContent, ...content }
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE messages SET message = ? WHERE chat_id = ? AND id = ?", 
                [JSON.stringify(updatedMessage), chatId, messageId], 
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async deleteMessage(chatId: string, messageId: string): Promise<void> {
        logger.info({ message: 'Deleting message', chatId, messageId })
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM messages WHERE chat_id = ? AND id = ?", [chatId, messageId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async addModel(model: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO models (name) VALUES (?)", [model], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve()
                }
            });
        });
    }

    async listModels(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT name FROM models", [], function (err, rows: any[]) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.name));
                }
            });
        });
    }

    async savePreset(name: string, config: PresetConfig): Promise<string> {
        const id = IdGen.generate(EntityType.Preset)
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO presets (id, name, preset) VALUES (?, ?, ?)", [id, name, JSON.stringify(config)], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id)
                }
            });
        });
    }

    async listPresets(): Promise<Pick<Preset, 'id' | 'name'>[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT id, name FROM presets ORDER BY created_at DESC LIMIT 20", [], function (err, rows: any[]) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        id: row.id,
                        name: row.name,
                    })))
                }
            });
        });
    }

    async getPreset(id: string): Promise<Preset | null> {
        if (id === 'default') {
            return null
        }

        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM presets WHERE id = ?", [id], function (err, row: any) {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null)
                } else {
                    resolve({
                        id: row.id,
                        name: row.name,
                        config: JSON.parse(row.preset),
                        createdAt: row.created_at
                    })
                }
            });
        });
    }

    async deletePreset(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM presets WHERE id = ?", [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve()
                }
            });
        });
    }

    async updatePreset(id: string, config: PresetConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE presets SET preset = ? WHERE id = ?", [JSON.stringify(config), id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve()
                }
            });
        });
    }

    async listProjects(): Promise<Project[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT id, name, created_at FROM projects ORDER BY created_at DESC", [], function (err, rows: any[]) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => ({
                        id: row.id,
                        name: row.name,
                        createdAt: row.created_at
                    })))
                }
            });
        });
    }

    async createProject(name: string): Promise<string> {
        const id = IdGen.generate(EntityType.Project)
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO projects (id, name) VALUES (?, ?)", [id, name], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id)
                }
            });
        });
    }

    async getProject(id: string): Promise<Project | null> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT id, name, created_at FROM projects WHERE id = ?", [id], function (err, row: any) {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? {
                        id: row.id,
                        name: row.name,
                        createdAt: row.created_at
                    } : null)
                }
            });
        });
    }

    async updateProject(id: string, data: { name: string }): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE projects SET name = ? WHERE id = ?", [data.name, id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async deleteProject(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // First delete all messages in chats belonging to this project
                this.db.run(`
                    DELETE FROM messages
                    WHERE chat_id IN (
                        SELECT id FROM chats WHERE project_id = ?
                    )
                `, [id]);
                
                // Then delete all chats belonging to this project
                this.db.run("DELETE FROM chats WHERE project_id = ?", [id]);
                
                // Finally delete the project
                this.db.run("DELETE FROM projects WHERE id = ?", [id], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    async createDataset(projectId: string, name: string): Promise<string> {
        const id = IdGen.generate(EntityType.Dataset)
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO datasets (id, project_id, name) VALUES (?, ?, ?)", [id, projectId, name], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id)
                }
            });
        });
    }

    async updateDataset(id: string, data: Partial<Dataset>): Promise<void> {
        const clauses: string[] = []  
        const params: any[] = []
        if (data.projectId) {
            clauses.push("project_id = ?")
            params.push(data.projectId)
        }
        if (data.name) {
            clauses.push("name = ?")
            params.push(data.name)
        }
        if (data.isDeleted) {
            clauses.push("is_deleted = ?")
            params.push(data.isDeleted)
        }

        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE datasets SET ${clauses.join(", ")} WHERE id = ?`, [...params, id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async deleteDataset(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM datasets WHERE id = ?", [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async listDatasets(projectId?: string): Promise<Dataset[]> {
        const filters = [
            "is_deleted = false",
        ]
        const params: string[] = []
        if (projectId) {
            filters.push("project_id = ?")
            params.push(projectId)
        }
        const whereClause = filters.length > 0 ? `${filters.join(" AND ")}` : ""
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM datasets WHERE ${whereClause} ORDER BY created_at DESC`, params, function (err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map((row: any) => ({
                        id: row.id,
                        projectId: row.project_id,
                        name: row.name,
                        isDeleted: row.is_deleted,
                        createdAt: row.created_at
                    })))
                }
            });
        });
    }

}


let db: DbService

function connect() {
    if (!db) {
        db = new DbService()
        db.init()
    }
    return db
}

export { connect }
