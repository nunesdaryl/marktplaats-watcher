import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import Composer from "../components/Composer.jsx";
import ListingCard from "../components/ListingCard.jsx";
import Proposal, { watchFields } from "../components/Proposal.jsx";
import RichText from "../lib/text.jsx";
import { go } from "../lib/router.js";
import { historyFor } from "../lib/history.js";
import { streamChat } from "../lib/stream.js";
import { track } from "../lib/track.js";

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
function Assistant({ text, status, listings, proposals, savedProposals, search, onWatch, onAdjust, onProposalSaved, unsaved }) {
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
      {unsaved && <p className="status">Couldn't save this answer.</p>}
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
  const [unsaved, setUnsaved] = useState(null);
  const [mode, setMode] = useState("search");  // the composer switch: "search" (results now) or "watch" (set up a watch)
  const end = useRef(null);
  const saved = thread?.messages ?? [];

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [saved.length, live]);
  useEffect(() => { if (chatId && thread === null) go("/"); }, [chatId, thread]);   // deleted or not yours
  useEffect(() => { setUnsaved(null); }, [chatId]);

  async function send(message, sendMode = "search", fromChip = false) {
    message = message.trim();
    if (!message || live) return;
    setUnsaved(null);
    track("chat_sent", { mode: sendMode, kind: fromChip ? "suggestion" : chatId ? "follow-up" : "new chat" });
    const history = historyFor(saved);
    setLive({ user: message, status: sendMode === "watch" ? "Drafting a watch for you to check…" : "Thinking…", listings: [], text: "" });
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
    let proposal;
    try {
      try {
        await streamChat({
          token: await getToken(),
          body: { message, chatId: id, history, mode: sendMode,
                  watches: watches.map((w) => ({ id: w._id, label: w.title, summary: w.summary, active: w.active,
                    query: w.query, maxPriceEur: w.maxPriceEur, mustInclude: w.mustInclude, postcode: w.postcode,
                    maxDistanceKm: w.maxDistanceKm, schedule: w.schedule })) },
          onEvent: (e) => {
            if (e.type === "status") setLive((l) => ({ ...l, status: e.text }));
            else if (e.type === "listings") setLive((l) => ({ ...l, listings: e.listings }));
            else if (e.type === "delta") setLive((l) => ({ ...l, status: null, text: l.text + e.text }));
            else if (e.type === "reset") setLive((l) => ({ ...l, text: "" }));   // words before a tool call weren't the answer
            else if (e.type === "done") final = e;
            else if (e.type === "error") final = { answer: e.text, saved: e.saved };
          },
        });
      } catch {
        final = { answer: "The answer didn't come through. Please try again." };
      }
      final ??= { answer: "The answer was cut off. Please try again." };
      if (final.saved !== true) setUnsaved({ chatId: id, final });
      // "Watch it": open the watch setup, pre-filled from what the agent understood, ready to check and save
      proposal = sendMode === "watch" && final.proposals?.find((p) => p.type === "create");
    } finally {
      setLive(null);
    }
    if (proposal) onAdjust({ ...watchFields(proposal), schedule: proposal.schedule, notify: proposal.notify,
                             volumeNote: proposal.volumeNote });
  }

  const empty = !chatId && !live;
  const lastSaved = saved.at(-1);
  const showLiveUser = live && !(lastSaved?.role === "user" && lastSaved.content === live.user);

  if (empty) {
    return (
      <section className="chat empty-chat" aria-label="New chat">
        <div className="hello">
          <h1>What are you looking for?</h1>
          <p>Search Marktplaats in plain words, or switch to Watch it: we read and score every new listing for you. You choose which ones we e-mail, with the reason.</p>
        </div>
        <div className="empty-composer"><Composer onSend={send} busy={!!live} autoFocus mode={mode} onModeChange={setMode} /></div>
        <div className="suggestions">
          {SUGGESTIONS.map(([s, m]) => (
            <button key={s} className="chip" onClick={() => { setMode(m); track("chip_clicked", { mode: m }); send(s, m, true); }}>
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
        {unsaved && chatId != null && unsaved.chatId === chatId && <Assistant text={unsaved.final.answer} listings={unsaved.final.listings}
          proposals={unsaved.final.proposals} search={unsaved.final.searches?.at(-1)}
          onWatch={onWatch} onAdjust={onAdjust} unsaved />}
        <div ref={end} />
      </div>
      <div className="composer-dock"><Composer onSend={send} busy={!!live} mode={mode} onModeChange={setMode} /></div>
    </section>
  );
}
