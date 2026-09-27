// The conversation the chat API gets as context: the last 20 turns, each trimmed to what the API accepts.
export const MAX_TURNS = 20;
export const MAX_TURN_CHARS = 4000;   // must match main.py Turn.content max_length

export function historyFor(messages) {
  return messages.slice(-MAX_TURNS).map(({ role, content }) => ({
    role,
    content: content.length > MAX_TURN_CHARS ? `${content.slice(0, MAX_TURN_CHARS - 1)}…` : content,
  }));
}
