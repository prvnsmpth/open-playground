// place files you want to import through the `$lib` alias in this folder.
import { type Tool as OllamaTool, type Message as OllamaMessage, type ToolCall as OllamaToolCall } from "ollama"

// A message sent from the server to the client in a stream
export type StreamMessage = {
    type: 'user_msg_id' | 'asst_msg_id' | 'chat_title' | 'tool_response' | 'tool_msg_id' | 'tool_exec_start' | 'usage',
    content: any
} | {
    type: 'asst_response',
    content: OllamaMessage
}

export enum BuiltinTool {
    CodeInterpreter = 'code_interpreter',
}

export type Tool = BuiltinTool | OllamaTool
export function isBuiltinTool(tool: Tool): tool is BuiltinTool {
    return Object.values(BuiltinTool).includes(tool as BuiltinTool)
}

export type OutputFormat = {
    type: 'text' | 'json',
} | {
    type: 'json_schema',
    schema?: any
}

export type PresetConfig = {
    model?: string,
    outputFormat?: OutputFormat,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    tools?: Tool[],
}

export type GenerationConfig = {
    temperature?: number,
    maxTokens?: number,
    topP?: number,
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
    golden?: boolean
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
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: OllamaToolCall[]
}

export type Usage = {
    promptTokens: number;
    completionTokens: number
}

export type Dataset = {
    id?: string
    projectId: string
    name: string
    isDeleted: boolean
    createdAt: string
}

export const DefaultPreset: Preset = {
    config: {
        outputFormat: {
            type: 'text',
        },
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
        tools: [BuiltinTool.CodeInterpreter],
    },
    createdAt: Date.now(),
}

export const DefaultProject: Project = {
    id: 'p_default',
    name: 'Default Project',
    createdAt: Date.now(),
}

export type SendMessageRequest = {
    role: 'user' | 'tool' // Either the user sends a text message, or provides a tool response
    // TODO: we send content = null to simply run the current thread. 
    // Ideally, would be nice to have a separate request type that simply runs the current thread
    content: string | null 
    model: string
    genConfig: GenerationConfig
    tools?: Tool[]
    outputFormat?: OutputFormat
}
