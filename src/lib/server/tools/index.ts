import { CodeInterpreter } from './code-interpreter'

// Very basic tool interface, needs to be upgraded to handle actual tool calls
export interface ToolCallHandler {
    // Whether this tool applies or not
    check(responseText: string): boolean
    // Handle the response text and return the result
    handle(responseText: string): Promise<string | null>
}

export {
    CodeInterpreter
}