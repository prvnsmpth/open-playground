import sqlite3 from "sqlite3";
import { fromStore } from "svelte/store";

export type Chat = {
    id: number
    title?: string
    frozen?: boolean
    createdAt: string;
}

export type ChatMessage = {
    id?: number;
    chatId: number;
    role: string;
    content: string;
    createdAt: number;
}

export type ChatMessageContent = {
    role: string;
    content: string;
}

export class DbService {
    private db: sqlite3.Database

    constructor() {
        this.db = new sqlite3.Database("chats.db");
    }

    async init() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS 
                chats (
                    id INTEGER PRIMARY KEY, 
                    title TEXT NULL,
                    frozen BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            this.db.run(`CREATE TABLE IF NOT EXISTS 
                messages (
                    id INTEGER PRIMARY KEY, 
                    chat_id INTEGER, 
                    role TEXT, 
                    content TEXT, 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                    FOREIGN KEY(chat_id) REFERENCES chats(id)
                )`);

            // Enable foreign key constraints
            this.db.run("PRAGMA foreign_keys = ON");
        });
    }

    async createChat(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run("INSERT INTO chats DEFAULT VALUES", function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getChat(chatId: number): Promise<Chat> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM chats WHERE id = ?", [chatId], (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: row.id,
                        title: row.title,
                        frozen: row.frozen,
                        createdAt: row.created_at,
                    });
                }
            });
        })
    }

    async updateChat(chatId: number, chat: Partial<Chat>): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE chats SET title = ?, frozen = ? WHERE id = ?", [chat.title, chat.frozen, chatId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async listChats(): Promise<Chat[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM chats", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const chats = rows.map((row: any) => ({
                        id: row.id,
                        title: row.title,
                        frozen: row.frozen,
                        createdAt: row.created_at,
                    }));
                    resolve(chats);
                }
            });
        });
    }

    async deleteChat(chatId: number): Promise<void> {
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

    async getMessages(chatId: number): Promise<ChatMessage[]> {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT * FROM messages WHERE chat_id = ?", [chatId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const messages = rows.map((row: any) => ({
                        id: row.id,
                        chatId,
                        role: row.role, 
                        content: row.content,
                        createdAt: row.created_at,
                    }));
                    resolve(messages);
                }
            });
        });
    }

    async addMessage(chatId: number, role: string, content: string): Promise<number> {
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

    async updateMessage(chatId: number, messageId: number, content: string): Promise<void> {
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

    async deleteMessage(chatId: number, messageId: number): Promise<void> {
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
