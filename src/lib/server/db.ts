import type { Preset, PresetConfig } from "$lib"
import sqlite3 from "sqlite3"
import { ulid } from "ulid"

export enum EntityType {
    Chat = 'c',
    ChatMessage = 'cm',
    Preset = 'pr'
}

export type Chat = {
    id?: string
    title?: string
    systemPrompt?: string
    frozen?: boolean
    createdAt?: string;
}

export type ChatMessage = {
    id?: string;
    chatId: string;
    messageSeqNum: number;
    message: ChatMessageContent;
    model?: string
    createdAt?: number;
}

export type ChatMessageContent = {
    role: string;
    content: string;
}

export type Usage = {
    promptTokens: number;
    completionTokens: number
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
    }

    async init() {
        this.db.on('trace', (sql) => {
            console.log('SQL:', sql);
        })

        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY, 
                    title TEXT NULL,
                    system_prompt TEXT NULL,
                    frozen BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            this.db.run("PRAGMA foreign_keys = ON");
        });
    }

    private makeChat(row: any): Chat {
        return {
            id: row.id,
            title: row.title,
            systemPrompt: row.system_prompt,
            frozen: row.frozen,
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

    async createChat(systemPrompt: string | null = null): Promise<string> {
        return new Promise((resolve, reject) => {
            const id = IdGen.generate(EntityType.Chat)
            this.db.run("INSERT INTO chats (id, system_prompt) VALUES (?, ?)", [id, systemPrompt], function (err) {
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
            if (chat.frozen !== undefined) {
                clauses.push("frozen = ?")
                params.push(chat.frozen)
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

    async listChats(frozen?: boolean, offset: number = 0, limit: number = 50): Promise<Chat[]> {
        const whereClause = frozen !== undefined ? "WHERE frozen = ?" : "";
        const params = frozen !== undefined ? [frozen, limit, offset] : [limit, offset];
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM chats ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params, (err, rows) => {
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

    async addMessage(chatId: string, role: string, content: string, model: string): Promise<string> {
        const message = { role, content }
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

    async updateMessage(chatId: string, messageId: string, content: string): Promise<void> {
        const chatMessage = await this.getMessage(messageId)
        const updatedMessage = { ...chatMessage.message, content }
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
        console.log('Deleting message', chatId, messageId)
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
            this.db.all("SELECT id, name FROM presets", [], function (err, rows: any[]) {
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
