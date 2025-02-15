// place files you want to import through the `$lib` alias in this folder.

// A message sent from the server to the client in a stream
export type StreamMessage = {
    type: 'user_msg_id' | 'response' | 'asst_msg_id' | 'chat_title',
    content: any
}