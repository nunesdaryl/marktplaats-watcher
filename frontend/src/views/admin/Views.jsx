// The drilldown views: every list and record behind the dashboard's numbers. Rows open the next level.
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { NOTIFY_LABEL } from "../../../convex/schedule";
import Icon from "../../components/Icon.jsx";
import ListingCard from "../../components/ListingCard.jsx";
import RichText from "../../lib/text.jsx";
import { ConfirmButton } from "../WatchView.jsx";
import { FeedbackItem } from "./Overview.jsx";
import { DAY, dayLabel, euro, label, when } from "./nav.js";
import Table from "./Table.jsx";

const num = (v) => (v === undefined || v === null || v === "" ? undefined : Number(v));
const STAGES = { signed_up: "Signed up", setup: "Finished setup", chatted: "Chatted", watch: "Saved a watch", alert: "Got an alert" };
const NOTIFY = { great: "Great matches only", good: "Good matches", all: "Every new listing" };

export function CopyEmail({ email }) {
  const [done, setDone] = useState(false);
  return (
    <button className="icon-button small copy" title="Copy e-mail address" aria-label={`Copy ${email}`}
            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(email).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
      {done ? <span className="copied">Copied</span> : <Icon name="copy" size={14} />}
    </button>
  );
}

const Score = ({ s }) => (s === undefined || s === null ? "–"
  : <span className={`score-pill ${s >= 8 ? "great" : s >= 6 ? "good" : "low"}`}>{s}<small>/10</small></span>);
const Status = ({ s }) => <span className={`status-pill ${s}`}>{s}</span>;
const Person = ({ email }) => <span className="person">{email}</span>;

// ---------- Column sets, shared between lists ----------
const userCols = [
  { key: "email", label: "Account", render: (u) => <span className="cell-with-action"><Person email={u.email} /><CopyEmail email={u.email} /></span> },
  { key: "furthest", label: "Got to", render: (u) => STAGES[u.furthest] ?? u.furthest },
  { key: "createdAt", label: "Signed up", render: (u) => when(u.createdAt), mono: true },
  { key: "lastActive", label: "Last active", render: (u) => when(u.lastActive), mono: true },
  { key: "watchesActive", label: "Watches", align: "right", mono: true,
    render: (u) => `${u.watchesActive}${u.watchesPaused ? ` +${u.watchesPaused} paused` : ""}`, csv: (u) => u.watchesActive },
  { key: "chats", label: "Chats", align: "right", mono: true },
  { key: "alerts", label: "Alerts", align: "right", mono: true },
  { key: "feedback", label: "Feedback", align: "right", mono: true },
  { key: "devices", label: "Device", render: (u) => u.devices.join(", ") || "–", csv: (u) => u.devices.join(" ") },
];
const watchCols = (withPerson = true) => [
  { key: "title", label: "Watch", render: (w) => <strong>{w.title}</strong> },
  ...(withPerson ? [{ key: "email", label: "Account", render: (w) => <Person email={w.email} /> }] : []),
  { key: "query", label: "Searches for", render: (w) => [w.query, w.mustInclude && `+ "${w.mustInclude}"`].filter(Boolean).join(" ") },
  { key: "maxPriceEur", label: "Max", render: (w) => euro(w.maxPriceEur), mono: true, align: "right" },
  { key: "postcode", label: "Near", render: (w) => (w.postcode ? `${w.maxDistanceKm ?? "?"} km of ${w.postcode}` : "–") },
  { key: "schedule", label: "Checks", render: (w) => w.schedule },
  { key: "notify", label: "E-mails", render: (w) => NOTIFY[w.notify] ?? w.notify },
  { key: "status", label: "Status", render: (w) => <Status s={w.status} /> },
  { key: "alerts", label: "Alerts", align: "right", mono: true },
  { key: "lastCheckedAt", label: "Last checked", render: (w) => when(w.lastCheckedAt), mono: true },
];
const alertCols = (withPerson = true) => [
  { key: "createdAt", label: "Found", render: (a) => when(a.createdAt), mono: true },
  { key: "title", label: "Listing", render: (a) => <strong>{a.title}</strong> },
  { key: "priceEur", label: "Price", render: (a) => euro(a.priceEur), mono: true, align: "right" },
  { key: "score", label: "Score", render: (a) => <Score s={a.score} />, align: "right" },
  { key: "watch", label: "Watch" },
  ...(withPerson ? [{ key: "email", label: "Account", render: (a) => <Person email={a.email} /> }] : []),
  { key: "emailStatus", label: "E-mail", render: (a) => <Status s={a.emailStatus} /> },
];
const chatCols = (withPerson = true) => [
  { key: "title", label: "Chat", render: (c) => <strong>{c.title}</strong> },
  ...(withPerson ? [{ key: "email", label: "Account", render: (c) => <Person email={c.email} /> }] : []),
  { key: "messages", label: "Messages", align: "right", mono: true },
  { key: "updatedAt", label: "Last used", render: (c) => when(c.updatedAt), mono: true },
  { key: "flags", label: "", render: (c) => [c.pinned && "pinned", c.archived && "archived"].filter(Boolean).join(", "), sort: (c) => (c.pinned ? 1 : 0) },
];
const eventDetails = (e) => (e.props ? Object.values(e.props).filter(Boolean).map(label).join(" · ") : "");
const eventCols = (withPerson = true) => [
  { key: "at", label: "When", render: (e) => when(e.at), mono: true },
  ...(withPerson ? [{ key: "email", label: "Account", render: (e) => <Person email={e.email} /> }] : []),
  { key: "name", label: "What", render: (e) => label(e.name) },
  { key: "props", label: "Details", render: eventDetails, csv: eventDetails, sort: eventDetails },
  { key: "device", label: "Device" },
];

// ---------- Lists ----------
export function Users({ params, open }) {
  const rows = useQuery(api.admin.users, { stage: params.stage, stuck: params.stuck, activeSince: num(params.activeSince) }) ?? undefined;
  return <Table name="accounts" columns={userCols} rows={rows ?? undefined} searchKeys={["email"]}
                onOpen={(u) => open({ view: "user", title: u.email, params: { id: u._id } })} empty="No accounts match." />;
}

export function Watches({ params, open }) {
  const [status, setStatus] = useState(params.status ?? "");
  const rows = useQuery(api.admin.watches, { status: status || undefined, scheduleKey: params.scheduleKey, notify: params.notify,
    userId: params.userId, createdSince: num(params.createdSince), createdUntil: num(params.createdUntil) });
  const chips = (
    <div className="chips" role="group" aria-label="Status">
      {["", "active", "paused", "archived"].map((s) => (
        <button key={s} className={`chip ${status === s ? "selected" : ""}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{s || "all"}</button>
      ))}
    </div>
  );
  return <Table name="watches" columns={watchCols()} rows={rows ?? undefined} searchKeys={["title", "query", "email", "postcode"]}
                chips={chips} onOpen={(w) => open({ view: "watch", title: w.title, params: { id: w._id } })} empty="No watches match." />;
}

export function Alerts({ params, open }) {
  const rows = useQuery(api.admin.alerts, { since: num(params.since), until: num(params.until), minScore: num(params.minScore),
    emailStatus: params.emailStatus, watchId: params.watchId, userId: params.userId });
  return <Table name="alerts" columns={alertCols()} rows={rows ?? undefined} searchKeys={["title", "watch", "email", "city"]}
                onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} empty="No alerts in this range." />;
}

export function Chats({ params, open }) {
  const rows = useQuery(api.admin.chats, { userId: params.userId, since: num(params.since), until: num(params.until) });
  return <Table name="chats" columns={chatCols()} rows={rows ?? undefined} searchKeys={["title", "email"]}
                onOpen={(c) => open({ view: "chat", title: c.title, params: { id: c._id } })} empty="No saved chats." />;
}

export function Events({ params, open }) {
  const rows = useQuery(api.admin.events, { name: params.name, section: params.section, device: params.device, mode: params.mode,
    value: params.value, userId: params.userId, since: num(params.since), until: num(params.until) });
  return <Table name="activity" columns={eventCols()} rows={rows ?? undefined} searchKeys={["email", "name"]}
                onOpen={(e) => open({ view: "user", title: e.email, params: { id: e.userId } })} empty="No activity recorded here yet." />;
}

export function Feedback({ params, open }) {
  const [handled, setHandled] = useState(params.handled ?? "");
  const rows = useQuery(api.admin.feedback, { limit: 200, wouldPay: params.wouldPay, userId: params.userId,
    handled: handled === "" ? undefined : handled === "yes" });
  const setDone = useMutation(api.admin.setFeedbackHandled);
  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Handled">
        {[["", "all"], ["no", "to do"], ["yes", "handled"]].map(([v, t]) => (
          <button key={v} className={`chip ${handled === v ? "selected" : ""}`} aria-pressed={handled === v} onClick={() => setHandled(v)}>{t}</button>
        ))}
      </div>
      {rows === undefined ? <p className="hint">Loading…</p> : rows.length === 0 ? <p className="hint">No feedback here.</p> : (
        <ul className="fb-list">
          {rows.map((f) => (
            <FeedbackItem key={f._id} f={f}
              onPerson={() => open({ view: "user", title: f.email, params: { id: f.userId } })}
              action={<button className={`button ${f.handledAt ? "" : "tinted"}`}
                              onClick={() => setDone({ id: f._id, handled: !f.handledAt })}>
                        <Icon name={f.handledAt ? "restore" : "compose"} size={15} />{f.handledAt ? `Handled ${when(f.handledAt)} · reopen` : "Mark handled"}
                      </button>} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function Ratings({ params, open }) {
  const rows = useQuery(api.admin.ratings, { verdict: params.verdict, reason: params.reason, band: params.band, userId: params.userId });
  const cols = [
    { key: "at", label: "When", render: (r) => when(r.at), mono: true },
    { key: "verdict", label: "Said", render: (r) => (r.verdict === "good" ? "Good match" : "Not right"), sort: (r) => r.verdict },
    { key: "score", label: "Score", render: (r) => <Score s={r.score} />, align: "right" },
    { key: "title", label: "Listing", render: (r) => <strong>{r.title}</strong> },
    { key: "reasons", label: "Why", render: (r) => [...r.reasons, r.note && `"${r.note}"`].filter(Boolean).join(" · ") || "–",
      csv: (r) => [...r.reasons, r.note].filter(Boolean).join(" | "), sort: (r) => r.reasons.join() },
    { key: "reason", label: "Scorer's reason", render: (r) => <span className="muted">{r.reason}</span> },
    { key: "email", label: "Account", render: (r) => <Person email={r.email} /> },
    { key: "source", label: "From" },
  ];
  return <Table name="ratings" columns={cols} rows={rows ?? undefined} searchKeys={["title", "note", "email", "reason"]}
                onOpen={(r) => open({ view: "alert", title: r.title, params: { id: r.alertId } })} empty="No ratings here yet." />;
}

// ---------- Records ----------
function Facts({ items }) {
  return <dl className="facts">{items.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function User({ params, open }) {
  const u = useQuery(api.admin.user, { userId: params.id });
  const [tab, setTab] = useState("watches");
  if (u === undefined) return <p className="hint">Loading…</p>;
  if (u === null) return <p className="hint">This account no longer exists.</p>;
  const tabs = [["watches", `Watches ${u.watches.length}`], ["chats", `Chats ${u.chats.length}`], ["alerts", `Alerts ${u.alerts.length}`],
    ["feedback", `Feedback ${u.feedback.length}`], ["activity", `Activity ${u.events.length}`]];
  return (
    <div className="stack">
      <div className="record-head">
        <h3><Person email={u.email} /> <CopyEmail email={u.email} /></h3>
        <Facts items={[["Signed up", when(u.createdAt)], ["Finished setup", u.onboardedAt ? when(u.onboardedAt) : "not yet"],
          ["Last active", when(u.events[0]?.at ?? u.chats[0]?.updatedAt)]]} />
      </div>
      <div className="segmented" role="tablist">
        {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === "watches" && <Table name={`${u.email}-watches`} columns={watchCols(false)} rows={u.watches}
                                   onOpen={(w) => open({ view: "watch", title: w.title, params: { id: w._id } })} empty="No watches." />}
      {tab === "chats" && <Table name={`${u.email}-chats`} columns={chatCols(false)} rows={u.chats} searchKeys={["title"]}
                                 onOpen={(c) => open({ view: "chat", title: c.title, params: { id: c._id } })} empty="No saved chats." />}
      {tab === "alerts" && <Table name={`${u.email}-alerts`} columns={alertCols(false)} rows={u.alerts} searchKeys={["title", "watch"]}
                                  onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} empty="No alerts." />}
      {tab === "feedback" && <Table name={`${u.email}-feedback`} rows={u.feedback} empty="No feedback."
        columns={[{ key: "createdAt", label: "Sent", render: (f) => when(f.createdAt), mono: true }, { key: "message", label: "Message" },
                  { key: "wouldPay", label: "Would pay" }, { key: "page", label: "Page" },
                  { key: "handledAt", label: "Handled", render: (f) => (f.handledAt ? when(f.handledAt) : "to do") }]}
        onOpen={() => open({ view: "feedback", title: `Feedback from ${u.email}`, params: { userId: u._id } })} />}
      {tab === "activity" && <Table name={`${u.email}-activity`} columns={eventCols(false)} rows={u.events} empty="No activity recorded yet (tracking started 29 Sep)." />}
    </div>
  );
}

export function Watch({ params, open }) {
  const w = useQuery(api.admin.watch, { watchId: params.id });
  const setActive = useMutation(api.admin.setWatchActive);
  const [error, setError] = useState("");
  if (w === undefined) return <p className="hint">Loading…</p>;
  if (w === null) return <p className="hint">This watch no longer exists.</p>;
  return (
    <div className="stack">
      <div className="record-head">
        <p className="sentence small">
          Checking Marktplaats for <mark>{w.label}</mark> <mark>{w.schedule}</mark>, e-mailing <mark>{NOTIFY_LABEL[w.notify] ?? w.notify}</mark>.
        </p>
        <Facts items={[
          ["Account", <button className="link-button" onClick={() => open({ view: "user", title: w.email, params: { id: w.userId } })}>{w.email}</button>],
          ["Status", <Status s={w.status} />], ["Searches for", w.query], w.mustInclude && ["Must include", w.mustInclude],
          ["Max price", euro(w.maxPriceEur)], w.postcode && ["Near", `${w.maxDistanceKm ?? "?"} km of ${w.postcode}`],
          ["Created", when(w.createdAt)], ["Last checked", when(w.lastCheckedAt)], ["Next check", w.nextCheck ?? "–"],
          ["Listings seen", w.seen], w.lastError && ["Last error", <span className="error">{w.lastError}</span>],
        ]} />
        {w.status !== "archived" && (
          <div className="record-actions">
            <ConfirmButton key={w.status} icon={w.status === "active" ? "pause" : "play"}
              label={w.status === "active" ? "Pause this watch" : "Resume this watch"}
              confirmLabel={w.status === "active" ? `Pause ${w.email}'s watch? Tap again` : "Resume it? Tap again"}
              onConfirm={() => setActive({ watchId: w._id, active: w.status !== "active" }).then(() => setError("")).catch((e) => setError(e.data ?? "That didn't work."))} />
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
      <h4>Alerts ({w.alertList.length})</h4>
      <Table name={`watch-${w.title}-alerts`} columns={alertCols(false)} rows={w.alertList} searchKeys={["title"]}
             onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} empty="No alerts yet." />
    </div>
  );
}

export function Alert({ params, open }) {
  const a = useQuery(api.admin.alert, { alertId: params.id });
  if (a === undefined) return <p className="hint">Loading…</p>;
  if (a === null) return <p className="hint">This alert no longer exists (alerts are kept 30 days).</p>;
  return (
    <div className="alert-detail">
      <div className="alert-card"><ListingCard listing={{ ...a, price_eur: a.priceEur }} score={a.score} reason={a.reason} /></div>
      <Facts items={[
        ["Found", when(a.createdAt)], ["Score", <Score s={a.score} />], ["Why", a.reason], ["Price", euro(a.priceEur)], a.city && ["Place", a.city],
        ["E-mail", <><Status s={a.emailStatus} />{a.attempts > 1 ? ` after ${a.attempts} tries` : ""}</>],
        ["Watch", <button className="link-button" onClick={() => open({ view: "watch", title: a.watch, params: { id: a.watchId } })}>{a.watch}</button>],
        ["Account", <button className="link-button" onClick={() => open({ view: "user", title: a.email, params: { id: a.userId } })}>{a.email}</button>],
        ["Listing", <a href={a.url} target="_blank" rel="noopener noreferrer">Open on Marktplaats <Icon name="external" size={13} /></a>],
      ]} />
    </div>
  );
}

export function Chat({ params, open }) {
  const c = useQuery(api.admin.chat, { chatId: params.id });
  if (c === undefined) return <p className="hint">Loading…</p>;
  if (c === null) return <p className="hint">This chat was deleted (chats are kept 30 days after last use).</p>;
  return (
    <div className="stack">
      <Facts items={[
        ["Account", <button className="link-button" onClick={() => open({ view: "user", title: c.email, params: { id: c.userId } })}>{c.email}</button>],
        ["Last used", when(c.updatedAt)], ["Messages", c.messages.length],
        (c.pinned || c.archived) && ["Flags", [c.pinned && "pinned", c.archived && "archived"].filter(Boolean).join(", ")],
      ]} />
      <div className="transcript">
        {c.messages.map((m) => m.role === "user" ? (
          <div key={m._id} className="msg user"><p>{m.content}</p><span className="msg-time">{when(m.at)}</span></div>
        ) : (
          <div key={m._id} className="msg assistant">
            {m.listings.length > 0 && <div className="cards">{m.listings.map((l, i) => <ListingCard key={l.id ?? i} listing={l} />)}</div>}
            <div className="answer"><RichText text={m.content} /></div>
            {m.proposals.map((p, i) => (
              <p key={i} className="proposal-note">
                <Icon name="eye" size={14} /> Proposed {p.type === "create" ? "a watch" : "a change"}: {p.label ?? p.query ?? "a watch"}
                {m.savedProposals.includes(i) ? " · saved" : " · not saved"}
              </p>
            ))}
            {m.search && <p className="msg-meta">Searched: {Object.entries(m.search).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}</p>}
            <span className="msg-time">{when(m.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Day({ params, open }) {
  const d = useQuery(api.admin.day, { day: params.day });
  if (d === undefined) return <p className="hint">Loading…</p>;
  if (d === null) return <p className="hint">Unknown day.</p>;
  const since = Date.parse(`${d.day}T00:00:00Z`);
  const section = (title, count, body) => <section className="day-section"><h4>{title} <span className="dt-count">{count}</span></h4>{body}</section>;
  return (
    <div className="stack">
      <p className="hint">{dayLabel(d.day)} (UTC day) · {d.searches} "Search now" and {d.watchChats} "Watch it" chat messages</p>
      {section("Active people", d.active.length, <Table name={`${d.day}-active`} rows={d.active} empty="Nobody."
        columns={[{ key: "email", label: "Account", render: (r) => <Person email={r.email} /> }, { key: "actions", label: "Actions", align: "right", mono: true }]}
        onOpen={(r) => open({ view: "user", title: r.email, params: { id: r.userId } })} />)}
      {section("Sign-ups", d.signups.length, <Table name={`${d.day}-signups`} rows={d.signups} empty="None."
        columns={[{ key: "email", label: "Account", render: (r) => <Person email={r.email} /> }, { key: "createdAt", label: "At", render: (r) => when(r.createdAt), mono: true }]}
        onOpen={(r) => open({ view: "user", title: r.email, params: { id: r._id } })} />)}
      {section("Chats used", d.chats.length, <Table name={`${d.day}-chats`} rows={d.chats} empty="None."
        columns={chatCols().filter((c) => c.key !== "messages" && c.key !== "flags")} onOpen={(c) => open({ view: "chat", title: c.title, params: { id: c._id } })} />)}
      {section("Watches created", d.watches.length, <Table name={`${d.day}-watches`} rows={d.watches} empty="None."
        columns={watchCols().filter((c) => !["alerts", "lastCheckedAt"].includes(c.key))} onOpen={(w) => open({ view: "watch", title: w.title, params: { id: w._id } })} />)}
      {section("Alerts found", d.alerts.length, <Table name={`${d.day}-alerts`} rows={d.alerts} empty="None."
        columns={alertCols()} onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} />)}
      <button className="link-button" onClick={() => open({ view: "events", title: `Activity on ${dayLabel(d.day)}`, params: { since, until: since + DAY } })}>
        See every recorded action that day →
      </button>
    </div>
  );
}

export const VIEWS = { users: Users, user: User, watches: Watches, watch: Watch, alerts: Alerts, alert: Alert, chats: Chats,
  chat: Chat, events: Events, feedback: Feedback, day: Day, ratings: Ratings };
