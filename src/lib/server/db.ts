import sqlite3 from "sqlite3"
import { ulid } from "ulid"

export enum Entity {
    Chat = 'c',
    ChatMessage = 'cm',
    Model = 'm',
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
    role: string;
    content: string;
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
    static generate(entity: Entity): string {
        return `${entity}_${ulid()}`
    }
}

export class DbService {
    private db: sqlite3.Database

    constructor() {
        this.db = new sqlite3.Database("playground.db");
        this.db.on('trace', (sql) => {
            console.log('SQL:', sql);
        })
    }

    async init() {
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
                    role TEXT, 
                    content TEXT, 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                    FOREIGN KEY(chat_id) REFERENCES chats(id)
                )
            `);
            this.db.run(`
                CREATE TABLE IF NOT EXISTS models (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    params BLOB
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
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
        };
    }

    async createChat(): Promise<number> {
        return new Promise((resolve, reject) => {
            const id = IdGen.generate(Entity.Chat)
            this.db.run("INSERT INTO chats (id) VALUES (?)", [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getChat(chatId: string): Promise<Chat> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM chats WHERE id = ?", [chatId], (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.makeChat(row));
                }
            });
        })
    }

    async updateChat(chatId: string, chat: Partial<Chat>): Promise<void> {
        return new Promise((resolve, reject) => {
            const clauses = []
            if (chat.title !== undefined) {
                clauses.push("title = ?")
            }
            if (chat.systemPrompt !== undefined) {
                clauses.push("system_prompt = ?")
            }
            if (chat.frozen !== undefined) {
                clauses.push("frozen = ?")
            }
            const clauseStr = clauses.join(", ")
            this.db.run(`UPDATE chats SET ${clauseStr} WHERE id = ?`, [chat.title, chat.frozen, chatId], function (err) {
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

    async addMessage(chatId: string, role: string, content: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)", [chatId, role, content], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateMessage(chatId: string, messageId: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE messages SET content = ? WHERE chat_id = ? AND id = ?", [content, chatId, messageId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
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
}

const db = new DbService();
db.init()

export { db }
