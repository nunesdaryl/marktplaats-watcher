import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import Composer from "../components/Composer.jsx";
import ListingCard from "../components/ListingCard.jsx";
import Proposal, { watchFields } from "../components/Proposal.jsx";
import RichText from "../lib/text.jsx";
import { go } from "../lib/router.js";
import { streamChat } from "../lib/stream.js";

const SUGGESTIONS = [
  ["Mac mini 16GB under €500", "search"],
  ["Gazelle bike near 3511AB, every morning at 8", "watch"],
  ["Nintendo Switch OLED under €200, only great matches", "watch"],
];

// The chat's search arguments -> the fields a new watch is pre-filled with
const fromSearch = (s) => ({
  query: s.query, mustInclude: s.must_include ?? undefined, maxPriceEur: s.max_price_eur ?? undefined,
  postcode: s.postcode ?? undefined, maxDistanceKm: s.max_distance_km ?? undefined,
});
const cleanSearch = (s) => s && Object.fromEntries(Object.entries(s).filter(([k]) =>
  ["query", "max_price_eur", "must_include", "postcode", "max_distance_km"].includes(k)));

function Assistant({ text, status, listings, proposals, savedProposals, search, onWatch, onAdjust, onProposalSaved }) {
  return (
    <div className="msg assistant">
      {status && <p className="status" role="status">{status}</p>}
      {listings?.length > 0 && (
        <div className="cards">{listings.map((l, i) => <ListingCard key={l.id ?? i} listing={l} />)}</div>
      )}
      {text && <div className="answer"><RichText text={text} /></div>}
      {proposals?.map((p, i) => (
        <Proposal key={i} p={p} saved={savedProposals?.includes(i)} onAdjust={onAdjust} onSaved={() => onProposalSaved?.(i)} />
      ))}
      {search && !proposals?.length && (
        <button className="button tinted" onClick={() => onWatch(fromSearch(search))}>Watch this search</button>
      )}
    </div>
  );
}

export default function ChatView({ chatId, watches, onWatch, onAdjust }) {
  const { getToken } = useAuth();
  const thread = useQuery(api.chats.messages, chatId ? { chatId } : "skip");
  const start = useMutation(api.chats.start);
  const append = useMutation(api.chats.append);
  const markSaved = useMutation(api.chats.markProposalSaved);
  const [live, setLive] = useState(null);   // the exchange in progress: { user, status, listings, text }
  const [mode, setMode] = useState("search");  // the composer switch: "search" (results now) or "watch" (set up a watch)
  const end = useRef(null);
  const saved = thread?.messages ?? [];

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [saved.length, live]);
  useEffect(() => { if (chatId && thread === null) go("/"); }, [chatId, thread]);   // deleted or not yours

  async function send(message, sendMode = "search") {
    message = message.trim();
    if (!message || live) return;
    const history = saved.slice(-20).map(({ role, content }) => ({ role, content }));
    setLive({ user: message, status: sendMode === "watch" ? "Setting up a watch…" : "Thinking…", listings: [], text: "" });
    let id = chatId;
    try {
      if (id) await append({ chatId: id, role: "user", content: message });
      else { id = await start({ content: message }); go(`/c/${id}`); }
    } catch (e) {
      setLive({ user: message, status: null, listings: [], text: e.data ?? "Couldn't save this chat. Try again." });
      setTimeout(() => setLive(null), 4000);
      return;
    }
    let final = null;
    await streamChat({
      token: await getToken(),
      body: { message, history, mode: sendMode,
              watches: watches.map((w) => ({ id: w._id, label: w.label, summary: w.summary, active: w.active })) },
      onEvent: (e) => {
        if (e.type === "status") setLive((l) => ({ ...l, status: e.text }));
        else if (e.type === "listings") setLive((l) => ({ ...l, listings: e.listings }));
        else if (e.type === "delta") setLive((l) => ({ ...l, status: null, text: l.text + e.text }));
        else if (e.type === "done") final = e;
        else if (e.type === "error") final = { answer: e.text };
      },
    });
    final ??= { answer: "The answer was cut off. Please try again." };
    await append({
      chatId: id, role: "assistant", content: final.answer || "…",
      listings: final.listings?.length ? final.listings : undefined,
      proposals: final.proposals?.length ? final.proposals : undefined,
      search: cleanSearch(final.searches?.at(-1)),
    }).catch(() => {});
    setLive(null);
    // "Watch it": open the watch setup, pre-filled from what the agent understood, ready to check and save
    const proposal = sendMode === "watch" && final.proposals?.find((p) => p.type === "create");
    if (proposal) onAdjust({ ...watchFields(proposal), schedule: proposal.schedule, notify: proposal.notify });
  }

  const empty = !chatId && !live;
  const lastSaved = saved.at(-1);
  const showLiveUser = live && !(lastSaved?.role === "user" && lastSaved.content === live.user);

  if (empty) {
    return (
      <section className="chat empty-chat" aria-label="New chat">
        <div className="hello">
          <h1>What are you looking for?</h1>
          <p>Search Marktplaats in plain words, or ask me to keep an eye on something.</p>
        </div>
        <div className="empty-composer"><Composer onSend={send} busy={!!live} autoFocus mode={mode} onModeChange={setMode} /></div>
        <div className="suggestions">
          {SUGGESTIONS.map(([s, m]) => (
            <button key={s} className="chip" onClick={() => { setMode(m); send(s, m); }}>
              <span className="chip-kind">{m === "watch" ? "Watch" : "Search"}</span>{s}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="chat" aria-label="Chat">
      <div className="thread">
        {saved.map((m) => m.role === "user"
          ? <div key={m._id} className="msg user"><p>{m.content}</p></div>
          : <Assistant key={m._id} text={m.content} listings={m.listings} proposals={m.proposals}
                       savedProposals={m.savedProposals} search={m.search} onWatch={onWatch} onAdjust={onAdjust}
                       onProposalSaved={(i) => markSaved({ messageId: m._id, index: i })} />)}
        {showLiveUser && <div className="msg user"><p>{live.user}</p></div>}
        {live && <Assistant text={live.text} status={live.status} listings={live.listings} />}
        <div ref={end} />
      </div>
      <div className="composer-dock"><Composer onSend={send} busy={!!live} mode={mode} onModeChange={setMode} /></div>
    </section>
  );
}
