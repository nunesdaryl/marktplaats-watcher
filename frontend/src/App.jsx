import { useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [messages, setMessages] = useState([]); // [{ role, content }]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    const history = [...messages, { role: "user", content: message }];
    setMessages([...history, { role: "assistant", content: "Searching…", pending: true }]);
    setInput("");
    setBusy(true);
    // Ask the agent (backend at /api/chat)
    let answer;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages.map(({ role, content }) => ({ role, content })) }),
      });
      answer = (await res.json()).answer;
    } catch {
      // server down, or it sent something that isn't JSON
    }
    setMessages([...history, { role: "assistant", content: answer ?? "Error: check the server" }]);
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h2>🛒 Marktplaats Watcher</h2>
      {messages.map((m, i) => (
        <p key={i} style={{ textAlign: m.role === "user" ? "right" : "left", whiteSpace: "pre-line",
                            color: m.pending ? "#888" : undefined }}>
          <b>{m.role === "user" ? "You:" : "Agent:"}</b> {m.content}
        </p>
      ))}
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
               placeholder="Mac mini under €500?" style={{ flex: 1, padding: 8 }} />
        <button type="submit" disabled={busy}>Send</button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
