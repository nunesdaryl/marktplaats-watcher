// Reads the chat's newline-delimited JSON events (status, listings, delta, done, error) as they arrive.
export async function streamChat({ token, body, onEvent }) {
  let res;
  try {
    res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    onEvent({ type: "error", text: "Can't reach the server. Check your connection and try again." });
    return;
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    onEvent({ type: "error", text: data.answer ?? data.detail ?? "Something went wrong. Please try again." });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
