import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const EXAMPLES = ["Mac mini 16GB under €500", "Mac mini under €600 within 20 km of 1012AB", "Cheapest Mac mini M1"];

// Show the model's light markdown (bold, links, bullets) as React elements.
// No innerHTML: React escapes all text, and only marktplaats.nl links become clickable.
function inline(text, key) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/\S+)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${i++}`}>{m[1]}</strong>);
    else {
      const url = m[3] || m[4];
      parts.push(url.startsWith("https://www.marktplaats.nl/")
        ? <a key={`${key}-${i++}`} href={url} target="_blank" rel="noopener noreferrer">View listing ↗</a>
        : m[2] || "");
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Answer({ text }) {
  return text.split("\n").filter((l) => l.trim()).map((line, i) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    return bullet
      ? <div key={i} className="item">{inline(bullet[1], i)}</div>
      : <p key={i}>{inline(line, i)}</p>;
  });
}

function App() {
  const [messages, setMessages] = useState([]); // [{ role, content }]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const next = [...messages, { role: "user", content: message }];
    setMessages([...next, { role: "assistant", content: "Searching Marktplaats…", pending: true }]);
    setInput("");
    setBusy(true);
    // Ask the agent (backend at /api/chat)
    let answer;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      answer = (await res.json()).answer;
    } catch {
      // server down, or it sent something that isn't JSON
    }
    setMessages([...next, { role: "assistant", content: answer ?? "Error: can't reach the server." }]);
    setBusy(false);
  }

  return (
    <div className="app">
      <header>
        <div className="logo">🛒</div>
        <div>
          <h1>Marktplaats Watcher</h1>
          <span>Tell me what you want, your budget and your postcode — I search Marktplaats.nl</span>
        </div>
      </header>

      <main>
        {messages.length === 0 && (
          <div className="empty">
            <p>What are you looking for?</p>
            <div className="chips">
              {EXAMPLES.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.pending ? "pending" : ""}`}>
            {m.role === "user" ? m.content : <Answer text={m.content} />}
          </div>
        ))}
        <div ref={end} />
      </main>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} autoFocus
               placeholder="e.g. Mac mini 16GB under €500 within 20 km of 1012AB" />
        <button type="submit" disabled={busy || !input.trim()}>{busy ? "…" : "Send"}</button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
