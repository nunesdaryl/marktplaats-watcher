import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { linkTo } from "../lib/router.js";

export default function WhatsNew() {
  const entries = useQuery(api.feedback.whatsNew);
  return <main className="whats-new page">
    <a {...linkTo("/")}>← Marktplaats Watcher</a>
    <h1>What's new</h1>
    <p>Improvements we built from feedback.</p>
    {entries === undefined ? <p>Loading…</p> : entries.length === 0 ? <p>New improvements will appear here.</p> :
      <ol>{entries.map((entry) => <li key={entry.id}>
        <time dateTime={new Date(entry.date).toISOString().slice(0, 10)}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(entry.date)}</time>
        <h2>{entry.title}</h2>
        <p>Suggested by {entry.credit}</p>
        <a href={entry.featureUrl}>Try it</a>
      </li>)}</ol>}
  </main>;
}
