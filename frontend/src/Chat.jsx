import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { NOTIFY_LABEL, describe } from "../convex/schedule";

const EXAMPLES = [
  "Mac mini 16GB under €500",
  "Watch for a Gazelle bike near 3511AB, every morning at 8",
  "Check my watches less often: every 3 hours",
];

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
      if (m[2]) parts.push(<strong key={`${key}-${i++}`}>{m[2]}</strong>);  // keep the listing title
      if (url.startsWith("https://www.marktplaats.nl/"))
        parts.push(<a key={`${key}-${i++}`} href={url} target="_blank" rel="noopener noreferrer">View listing</a>);
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

// The chat's tool args (snake_case, nulls) -> the watch fields Convex expects (camelCase, undefined)
function fromSearch(s) {
  return {
    query: s.query, mustInclude: s.must_include ?? undefined, maxPriceEur: s.max_price_eur ?? undefined,
    postcode: s.postcode ?? undefined, maxDistanceKm: s.max_distance_km ?? undefined,
  };
}
const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

function searchText(p) {
  return [p.query, p.mustInclude, p.maxPriceEur && `under €${p.maxPriceEur}`,
    p.postcode && p.maxDistanceKm && `within ${p.maxDistanceKm} km of ${p.postcode}`].filter(Boolean).join(", ");
}

function changeText(p) {
  return [
    p.schedule && `check it ${describe(p.schedule)}`,
    p.notify && `e-mail you ${NOTIFY_LABEL[p.notify]}`,
    p.maxPriceEur && `set the max price to €${p.maxPriceEur}`,
    p.active === false && "pause it",
    p.active === true && "resume it",
  ].filter(Boolean).join(", ");
}

/** A watch the chat suggested. Nothing is saved until you press the button. */
function Proposal({ p, onAdjust }) {
  const create = useMutation(api.watches.create);
  const update = useMutation(api.watches.update);
  const [state, setState] = useState("open");     // open | saving | saved | dismissed
  const [error, setError] = useState("");
  if (state === "dismissed") return null;

  async function save() {
    setState("saving");
    setError("");
    try {
      if (p.type === "create") await create({ ...defined(fromCamel(p)), schedule: p.schedule, notify: p.notify });
      else await update(defined({ id: p.watchId, schedule: p.schedule, notify: p.notify, active: p.active, maxPriceEur: p.maxPriceEur }));
      setState("saved");
    } catch (e) {
      setError(e.data ?? "Saving didn't work. Try again.");
      setState("open");
    }
  }

  return (
    <div className="proposal">
      {p.type === "create" ? (
        <p>Watch <strong>{searchText(p)}</strong>, checked <strong>{describe(p.schedule)}</strong>, and e-mail
          you {NOTIFY_LABEL[p.notify]}.</p>
      ) : (
        <p>For <strong>{p.label}</strong>: {changeText(p)}.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {state === "saved" ? (
        <p className="done">{p.type === "create" ? "Watch saved." : "Change saved."}</p>
      ) : (
        <div className="actions">
          <button className="primary" onClick={save} disabled={state === "saving"}>
            {p.type === "create" ? "Save watch" : "Save change"}
          </button>
          {p.type === "create"
            ? <button className="ghost" onClick={() => onAdjust({ ...defined(fromCamel(p)), schedule: p.schedule, notify: p.notify })}>Adjust</button>
            : <button className="ghost" onClick={() => setState("dismissed")}>Dismiss</button>}
        </div>
      )}
    </div>
  );
}

function fromCamel(p) {
  return { query: p.query, mustInclude: p.mustInclude, maxPriceEur: p.maxPriceEur, postcode: p.postcode, maxDistanceKm: p.maxDistanceKm };
}

export default function Chat({ watches, onWatch, onAdjust }) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]); // [{ role, content, searches?, proposals? }]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);  // braces: return nothing

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const next = [...messages, { role: "user", content: message }];
    setMessages([...next, { role: "assistant", content: "Searching Marktplaats…", pending: true }]);
    setInput("");
    setBusy(true);
    let reply = { answer: "Error: can't reach the server." };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          message, history,
          watches: watches.map((w) => ({ id: w._id, label: w.label, summary: w.summary, active: w.active })),
        }),
      });
      const data = await res.json();
      reply = data.answer ? data : { answer: data.detail ?? reply.answer };
    } catch {
      // server down, or it sent something that isn't JSON
    }
    setMessages([...next, { role: "assistant", content: reply.answer, searches: reply.searches, proposals: reply.proposals }]);
    setBusy(false);
  }

  return (
    <section className="chat" aria-label="Chat">
      <div className="log">
        {messages.length === 0 && (
          <div className="empty">
            <p>What are you looking for? Search first, or ask me to keep an eye on something.</p>
            <div className="chips">
              {EXAMPLES.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.pending ? "pending" : ""}`}>
            {m.role === "user" ? m.content : <Answer text={m.content} />}
            {m.proposals?.map((p, j) => <Proposal key={j} p={p} onAdjust={onAdjust} />)}
            {!m.proposals?.length && m.searches?.slice(-1).map((s, j) => (
              <button key={j} className="watch-this" onClick={() => onWatch(fromSearch(s))}>
                Watch this search
              </button>
            ))}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} autoFocus
               aria-label="Message" placeholder="e.g. Mac mini 16GB under €500 within 20 km of 1012AB" />
        <button type="submit" className="primary" disabled={busy || !input.trim()}>{busy ? "…" : "Send"}</button>
      </form>
    </section>
  );
}
