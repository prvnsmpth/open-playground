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
    id: string,
    name: string,
    config: PresetConfig,
    createdAt: number
}
