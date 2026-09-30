// The owner dashboard: the overview, with a drilldown panel on top when a number, bar or row was clicked.
// Only mounted for the owner (App.jsx); the server returns no data to anyone else (convex/admin.ts).
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import Icon from "../../components/Icon.jsx";
import { useDrill } from "./nav.js";
import Overview from "./Overview.jsx";
import { VIEWS } from "./Views.jsx";
import { intentToDrill } from "./ask.js";
import { AdminOptionsContext } from "./FilterBar.jsx";

const KIND = { users: "Accounts", user: "Account", watches: "Watches", watch: "Watch", alerts: "Alerts", alert: "Alert",
  chats: "Chats", chat: "Chat", events: "Activity", feedback: "Feedback", day: "Day", ratings: "Ratings",
  runs: "Runs", run: "Run", errors: "Errors", error: "Error", audits: "Delivery audit", catchups: "Catch-ups" };

function AdminSearch({ close, open }) {
  const [text, setText] = useState("");
  const results = useQuery(api.admin.search, { text });
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const choose = (result) => {
    close();
    open({ view: result.view, title: result.title, params: { id: result.id } }, { fresh: true });
  };
  return <div className="admin-search-backdrop" onClick={close}>
    <section className="admin-search" role="dialog" aria-modal="true" aria-label="Search dashboard" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && e.target === input.current && results?.[0]) choose(results[0]); }}>
      <label><Icon name="search" size={18} /><input ref={input} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search accounts, watches, alerts, chats, errors, runs" aria-label="Search dashboard" /></label>
      {text && <ul>{results?.map((result) => <li key={`${result.view}-${result.id}`}>
        <button onClick={() => choose(result)}><span>{KIND[result.view]}</span>{result.title}</button>
      </li>)}</ul>}
      {text && results?.length === 0 && <p className="hint">No matching records.</p>}
    </section>
  </div>;
}

function DrillPanel({ drill }) {
  const { current, open, crumb, close } = drill;
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current?.view, current?.params?.id, close]);
  const View = VIEWS[current.view];
  return (
    <>
      <div className="drill-scrim" onClick={close} aria-hidden="true" />
      <aside className="drill" role="dialog" aria-modal="true" aria-label={current.title || KIND[current.view]} tabIndex={-1} ref={ref}>
        <header className="drill-head">
          <nav className="crumbs" aria-label="Breadcrumbs">
            <button className="link-button" onClick={close}>Dashboard</button>
            {current.trail.map((t, i) => (
              <span key={i}><Icon name="chevron" size={12} /><button className="link-button" onClick={() => crumb(i)}>{t.title || KIND[t.view]}</button></span>
            ))}
          </nav>
          <button className="icon-button" onClick={close} aria-label="Close (Esc)" title="Close (Esc)"><Icon name="close" /></button>
        </header>
        <div className="drill-title">
          <span className="drill-kind">{KIND[current.view] ?? current.view}</span>
          <h2>{current.title || KIND[current.view]}</h2>
        </div>
        <div className="drill-body">
          {View ? <View params={current.params} open={open} update={drill.update} view={current.view} /> : <p className="hint">Unknown view.</p>}
        </div>
      </aside>
    </>
  );
}

function AdminAsk({ open, users, watches }) {
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!question.trim() || busy || !users || !watches) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ question: question.trim(), users: users.map((u) => u.email),
          watches: watches.map((w) => w.title ?? w.label) }),
      });
      if (!response.ok) throw new Error("I couldn't find that list. Please try again.");
      const intent = await response.json();
      const next = intentToDrill(intent, users, watches);
      if (next) {
        open(next, { fresh: true });
        setQuestion("");
      } else setMessage(intent.title);
    } catch (error) {
      setMessage(error.message || "I couldn't find that list. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-ask">
    <form onSubmit={submit}>
      <input aria-label="Ask the dashboard" type="text" maxLength={300} value={question}
        onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything: alerts for Vin this week above 8" />
      <button className="button tinted" type="submit" disabled={busy || !question.trim() || !users || !watches}>
        {busy ? "Finding…" : "Ask"}
      </button>
    </form>
    {message && <p className="hint" role="status">{message}</p>}
  </div>;
}

export default function AdminView() {
  const owner = useQuery(api.admin.amOwner);
  const users = useQuery(api.admin.userOptions, owner ? {} : "skip");
  const watches = useQuery(api.admin.watchOptions, owner ? {} : "skip");
  const drill = useDrill();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (owner === false) return null;   // App.jsx only mounts this for the owner; the server returns no data to anyone else
  return (
    <AdminOptionsContext.Provider value={{ users, watches }}>
      <Overview open={drill.open} onSearch={() => setSearchOpen(true)} ask={<AdminAsk open={drill.open} users={users} watches={watches} />} />
      {drill.current && <DrillPanel drill={drill} />}
      {searchOpen && <AdminSearch close={() => setSearchOpen(false)} open={drill.open} />}
    </AdminOptionsContext.Provider>
  );
}
