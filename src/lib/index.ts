// place files you want to import through the `$lib` alias in this folder.

// A message sent from the server to the client in a stream
export type StreamMessage = {
    type: 'user_msg_id' | 'asst_response' | 'asst_msg_id' | 'chat_title' | 'tool' | 'tool_msg_id' | 'tool_exec_start' | 'usage',
    content: any
}

export enum Tool {
    CodeInterpreter = 'code_interpreter',
}

export type PresetConfig = {
    model?: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    tools?: Tool[],
}

export type Preset = {
    id?: string,
    name?: string,
    config: PresetConfig,
    createdAt: number
}

export type Project = {
    id: string,
    name: string,
    createdAt: number
}

export type Chat = {
    id?: string
    projectId: string
    title?: string
    systemPrompt?: string
    frozen?: boolean
    createdAt?: number;
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

export const DefaultPreset: Preset = {
    config: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
        tools: [Tool.CodeInterpreter],
    },
    createdAt: Date.now(),
}

export const DefaultProject: Project = {
    id: 'p_default',
    name: 'Default Project',
    createdAt: Date.now(),
}

