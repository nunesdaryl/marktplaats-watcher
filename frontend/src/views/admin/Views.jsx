// The drilldown views: every list and record behind the dashboard's numbers. Rows open the next level.
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useContext, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { NOTIFY_LABEL, NOTIFY_SHORT, scoreLevel } from "../../../convex/schedule";
import Icon from "../../components/Icon.jsx";
import ListingCard from "../../components/ListingCard.jsx";
import RichText from "../../lib/text.jsx";
import { ConfirmButton } from "../WatchView.jsx";
import { FeedbackItem } from "./Overview.jsx";
import { DAY, useDateFilters, dayLabel, euro, label, when } from "./nav.js";
import FilterBar, { AdminOptionsContext } from "./FilterBar.jsx";
import Table from "./Table.jsx";
import { OpenAiSpendView } from "./OpenAiSpend.jsx";

const num = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));
const amsterdamDay = (at) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(at).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export function receivedTimestamp(day, now = Date.now()) {
  if (day === amsterdamDay(now)) return now;
  if (day > amsterdamDay(now)) throw new Error("Future received date");
  const utcNoon = Date.parse(`${day}T12:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hourCycle: "h23" }).format(utcNoon));
  return utcNoon - (hour - 12) * 3_600_000;
}
export const adminError = (error) => error instanceof ConvexError && typeof error.data === "string"
  ? error.data : "That didn't work. Try again.";
const STAGES = { signed_up: "Signed up", setup: "Finished setup", chatted: "Chatted", watch: "Saved a watch", alert: "Got an alert" };
const NOTIFY = Object.fromEntries(Object.entries(NOTIFY_LABEL).map(([level, text]) =>
  [level, `${text[0].toUpperCase()}${text.slice(1)} (${NOTIFY_SHORT[level]})`]));

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
  : <span className={`score-pill ${scoreLevel(s)}`}>{s}<small>/10</small> · {scoreLevel(s)}</span>);
const Status = ({ s }) => <span className={`status-pill ${s}`}>{s}</span>;
const Person = ({ email }) => <span className="person">{email}</span>;

// ---------- Column sets, shared between lists ----------
const userCols = [
  { key: "email", label: "Account", render: (u) => <span className="cell-with-action"><Person email={u.email} /><CopyEmail email={u.email} /></span> },
  { key: "aiBudget", label: "AI budget", render: (u) => u.aiBudget ? `€${u.aiBudget.spentEur.toFixed(2)} / €${u.aiBudget.limitEur.toFixed(2)}${u.aiBudget.allowed ? u.aiBudget.spentEur >= u.aiBudget.limitEur * 0.8 ? " · Near" : "" : " · Paused"}` : "–" },
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
const watchStatusOptions = { key: "status", label: "Status", options: [["active", "Active"], ["paused", "Paused"], ["archived", "Archived"]] };
const emailStatusOptions = { key: "emailStatus", label: "E-mail", options: [["pending", "Pending"], ["sent", "Sent"], ["failed", "Failed"], ["dry-run", "Dry run"]] };
function ListTable({ params, update, filter, ...table }) {
  return <div className="stack"><FilterBar params={params} update={update} {...filter} />
    <Table {...table} params={params} update={update} /></div>;
}

export function Users({ params, open, update }) {
  const rows = useQuery(api.admin.users, { stage: params.stage, stuck: params.stuck, activeSince: num(params.activeSince), userId: params.userId, ...useDateFilters(params), search: params.q }) ?? undefined;
  return <ListTable params={params} update={update} filter={{ status: { key: "stage", label: "Stage", options: Object.entries(STAGES) } }} name="accounts" columns={userCols} rows={rows?.rows} more={rows?.more} searchKeys={["email"]}
                onOpen={(u) => open({ view: "user", title: u.email, params: { id: u._id } })} empty="No accounts match." />;
}

export function Waitlist() {
  const rows = useQuery(api.admin.waitlist);
  return <Table name="waitlist" columns={[
    { key: "email", label: "E-mail" },
    { key: "lookingFor", label: "Looking for", render: (row) => row.lookingFor || "–" },
    { key: "createdAt", label: "Joined", render: (row) => when(row.createdAt), mono: true },
  ]} rows={rows?.rows} more={rows?.more} empty="Nobody is waiting." />;
}

export function Watches({ params, open, update }) {
  const rows = useQuery(api.admin.watches, { status: params.status, scheduleKey: params.scheduleKey, notify: params.notify,
    userId: params.userId, watchId: params.watchId, createdSince: num(params.createdSince), createdUntil: num(params.createdUntil), behind: params.behind === "yes" || undefined, ...useDateFilters(params), search: params.q });
  return <ListTable params={params} update={update} filter={{ watch: true, status: watchStatusOptions }}
    name="watches" columns={watchCols()} rows={rows?.rows} more={rows?.more} searchKeys={["title", "query", "mustInclude", "email", "postcode"]}
    onOpen={(w) => open({ view: "watch", title: w.title, params: { id: w._id } })} empty="No watches match." />;
}

export function Alerts({ params, open, update }) {
  const rows = useQuery(api.admin.alerts, { ...useDateFilters(params), minScore: num(params.minScore),
    emailStatus: params.emailStatus, watchId: params.watchId, userId: params.userId, search: params.q });
  return <ListTable params={params} update={update} filter={{ watch: true, score: true, status: emailStatusOptions }} name="alerts" columns={alertCols()} rows={rows?.rows} more={rows?.more} searchKeys={["title", "listingId", "watch", "email", "city"]}
                onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} empty="No alerts in this range." />;
}

export function Chats({ params, open, update }) {
  const rows = useQuery(api.admin.chats, { userId: params.userId, status: params.status, ...useDateFilters(params), search: params.q });
  return <ListTable params={params} update={update} filter={{ status: { key: "status", label: "Status", options: [["active", "Active"], ["archived", "Archived"], ["pinned", "Pinned"]] } }} name="chats" columns={chatCols()} rows={rows?.rows} more={rows?.more} searchKeys={["title", "email"]}
                onOpen={(c) => open({ view: "chat", title: c.title, params: { id: c._id } })} empty="No saved chats." />;
}

export function Events({ params, open, update }) {
  const rows = useQuery(api.admin.events, { name: params.name, section: params.section, device: params.device, mode: params.mode,
    value: params.value, userId: params.userId, ...useDateFilters(params), search: params.q });
  return <ListTable params={params} update={update} filter={{ status: { key: "name", label: "Kind", options: [
    ["page_view", "Page view"], ["chat_sent", "Chat sent"], ["watch_saved", "Watch saved"], ["alert_opened", "Alert opened"],
    ["listing_opened", "Listing opened"], ["feedback_sent", "Feedback sent"], ["theme_changed", "Theme changed"],
  ] } }} name="activity" columns={eventCols()} rows={rows?.rows} more={rows?.more} searchKeys={["email", "name", "device", eventDetails]}
                onOpen={(e) => open({ view: "user", title: e.email, params: { id: e.userId } })} empty="No activity recorded here yet." />;
}

export function Feedback({ params, open, update }) {
  const rows = useQuery(api.admin.feedback, { limit: 200, id: params.id, wouldPay: params.wouldPay, userId: params.userId,
    status: params.status, feedbackSource: params.feedbackSource, search: params.q, ...useDateFilters(params) });
  const [selected, setSelected] = useState(params.id ?? null);
  const [adding, setAdding] = useState(false);
  const shown = rows?.rows;
  const item = shown?.find((f) => f._id === selected);
  return <div className="stack">
    <button className="button tinted" onClick={() => setAdding(!adding)}>Add feedback</button>
    {adding && <AddFeedback onDone={() => setAdding(false)} />}
    <FilterBar params={params} update={update} status={{ key: "status", label: "Status", options: [["new", "New"], ["planned", "Planned"], ["in_progress", "In progress"], ["shipped", "Shipped"], ["declined", "Declined"]] }}
      source={{ key: "feedbackSource", label: "Source", options: [["app", "App"], ["email", "Email"], ["linkedin", "LinkedIn"], ["whatsapp", "WhatsApp"], ["in_person", "In person"], ["other", "Other"]] }} />
    {rows?.more && <p className="dt-count">Showing {shown.length} of {shown.length}+ — narrow the filters</p>}
    {shown === undefined ? <p className="hint">Loading…</p> : <Table name="feedback" rows={shown} empty="No feedback here." onOpen={(f) => setSelected(f._id)}
      columns={[
        { key: "createdAt", label: "Received", render: (f) => when(f.createdAt) },
        { key: "source", label: "Source" }, { key: "email", label: "Person", render: (f) => f.personName ? `${f.personName}${f.email !== f.personName ? ` · ${f.email}` : ""}` : f.email },
        { key: "status", label: "Status", render: (f) => f.status.replace("_", " ") },
        { key: "issues", label: "Issue", render: (f) => f.issues.join(", "), csv: (f) => f.issues.join(", ") },
        { key: "releaseSha", label: "Shipped in", render: (f) => f.releaseSha?.slice(0, 7) ?? "–" },
        { key: "repliedAt", label: "Replied", render: (f) => f.repliedAt ? when(f.repliedAt) : "–" },
      ]} />}
    {item && <FeedbackDetail key={item._id} f={item} close={() => setSelected(null)} open={open} />}
  </div>;
}

export function AddFeedback({ onDone }) {
  const users = useContext(AdminOptionsContext)?.users ?? [];
  const add = useMutation(api.admin.addFeedback);
  const uploadUrl = useMutation(api.admin.feedbackUploadUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInput = useRef(null);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    try {
      const file = form.get("screenshot");
      let screenshotId;
      if (file?.size) {
        if (file.size > 1_500_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP under 1.5 MB.");
        const url = await uploadUrl({});
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error("The screenshot could not be uploaded.");
        screenshotId = (await response.json()).storageId;
      }
      await add({ userId: form.get("userId") || undefined, personName: form.get("personName") || undefined,
        personEmail: form.get("personEmail") || undefined, receivedAt: receivedTimestamp(form.get("receivedAt")),
        source: form.get("source"), message: form.get("message"), paraphrase: form.has("paraphrase"), screenshotId,
        sourceUrl: form.get("sourceUrl") || undefined, creditName: form.has("creditName") });
      onDone();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return <form className="stack fb-editor" onSubmit={submit}>
    <label>Account <select name="userId"><option value="">Choose an account or enter a person below</option>{users.map((u) => <option key={u._id} value={u._id}>{u.email}</option>)}</select></label>
    <label>Name <input name="personName" maxLength="120" /></label>
    <label>E-mail <input name="personEmail" type="email" /></label>
    <label>Received <input name="receivedAt" type="date" defaultValue={amsterdamDay(Date.now())} max={amsterdamDay(Date.now())} required /></label>
    <label>Channel <select name="source">{["email", "linkedin", "whatsapp", "in_person", "other"].map((source) => <option key={source} value={source}>{source.replace("_", " ")}</option>)}</select></label>
    <label>Link to the post/message <input name="sourceUrl" type="url" placeholder="https://" /></label>
    <label><input name="creditName" type="checkbox" /> They agreed to be named publicly</label>
    <label>Their words or paraphrase <textarea name="message" maxLength="2000" required /></label>
    <label><input name="paraphrase" type="checkbox" /> Paraphrase</label>
    <div className="fb-attachment"><span>Screenshot</span><input ref={fileInput} name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Screenshot" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
      <button type="button" className="button tinted" onClick={() => fileInput.current?.click()}>Attach screenshot</button>{fileName && <span>{fileName}</span>}</div>
    {error && <p role="alert">{error}</p>}
    <button className="button tinted" disabled={busy}>Save feedback</button>
  </form>;
}

export function FeedbackDetail({ f, close, open }) {
  const update = useMutation(api.admin.updateFeedback);
  const send = useAction(api.feedback.sendReply);
  const mark = useMutation(api.admin.markFeedbackReplied);
  const linkIssue = useMutation(api.admin.linkFeedbackIssue);
  const [status, setStatus] = useState(f.status);
  const [note, setNote] = useState(f.note ?? "");
  const [reason, setReason] = useState(f.declinedReason ?? "");
  const [issues, setIssues] = useState(f.issues.join(", "));
  const [sha, setSha] = useState(f.releaseSha ?? "");
  const [releaseDate, setReleaseDate] = useState(f.releaseAt ? new Date(f.releaseAt).toISOString().slice(0, 10) : "");
  const [featureUrl, setFeatureUrl] = useState(f.featureUrl?.startsWith("/") ? f.featureUrl : "");
  const [publicTitle, setPublicTitle] = useState(f.publicTitle ?? "");
  const [showOnWhatsNew, setShowOnWhatsNew] = useState(f.showOnWhatsNew);
  const [draft, setDraft] = useState(f.replyDraft ?? "");
  useEffect(() => { if (f.replyDraft && !draft) setDraft(f.replyDraft); }, [f.replyDraft]);
  const [channel, setChannel] = useState(f.source === "app" ? "email" : f.source);
  const [linkId, setLinkId] = useState("");
  const [replyUrl, setReplyUrl] = useState(f.replyUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await update({ id: f._id, status, note, declinedReason: reason, issues: issues.split(/[\s,]+/).filter(Boolean),
      releaseSha: sha || undefined, releaseAt: releaseDate ? Date.parse(`${releaseDate}T12:00:00`) : undefined,
      replyDraft: draft || undefined, featureUrl: featureUrl || undefined,
      publicTitle, showOnWhatsNew }); }
    catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  };
  const reply = async (method) => {
    setBusy(true); setError("");
    try { if (draft !== f.replyDraft) await update({ id: f._id, status: f.status, note: f.note, declinedReason: f.declinedReason,
      issues: f.issues, releaseSha: f.releaseSha, releaseAt: f.releaseAt, replyDraft: draft,
      publicTitle: f.publicTitle, showOnWhatsNew: f.showOnWhatsNew });
      if (method === "send") await send({ id: f._id });
      else await mark({ id: f._id, channel, text: draft, replyUrl: replyUrl || undefined });
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  };
  return <section className="stack fb-editor" aria-label="Feedback timeline">
    <button className="link-button" onClick={close}>Close feedback</button>
    <ul className="fb-list"><FeedbackItem f={f} onPerson={f.userId ? () => open({ view: "user", title: f.email, params: { id: f.userId } }) : undefined} /></ul>
    <ol className="fb-timeline"><li>Received {when(f.createdAt)} · {f.source}</li>
      {f.timeline.map((event) => <li key={event._id}>{event.status.replace("_", " ")} · {when(event.at)} · {event.by}</li>)}
      {f.repliedAt && <li>Replied · {when(f.repliedAt)} · {f.replyChannel} · {f.repliedBy}{f.replyUrl && <> · <a href={f.replyUrl} target="_blank" rel="noopener noreferrer">Reply</a></>}</li>}</ol>
    {f.sourceUrl && <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">Open the post</a>}
    {(f.status === "new" || f.status === "planned") && <div className="stack">
      <label>Link to MW issue <input value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="MW-116" /></label>
      <button type="button" className="button tinted" disabled={busy || !linkId.trim()} onClick={async () => {
        setBusy(true); setError(""); try { await linkIssue({ id: f._id, issue: linkId }); setLinkId(""); }
        catch (err) { setError(adminError(err)); } finally { setBusy(false); }
      }}>Link to MW issue</button>
    </div>}
    <form className="stack" onSubmit={save}>
      <label>Status <select value={status} onChange={(e) => setStatus(e.target.value)}>{["new", "planned", "in_progress", "shipped", "declined"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
      <label>Note <textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {status === "declined" && <label>Reason <textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></label>}
      <label>Linked issues <input value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="MW-48, MW-51" /></label>
      <label>Where to try it <input value={featureUrl} onChange={(e) => setFeatureUrl(e.target.value)} placeholder="/watches/" /></label>
      <label>Public title <input maxLength={80} value={publicTitle} onChange={(e) => setPublicTitle(e.target.value)} placeholder="What shipped, in plain words" required={status === "shipped" && showOnWhatsNew} /></label>
      <label><input type="checkbox" checked={!!showOnWhatsNew} onChange={(e) => setShowOnWhatsNew(e.target.checked)} /> Show on What's new</label>
      {f.issues.map((id) => <a key={id} href={`https://linear.app/software-factory-ai/issue/${id}`} target="_blank" rel="noopener noreferrer">{id}</a>)}
      <label>Release SHA <input value={sha} onChange={(e) => setSha(e.target.value)} placeholder="Short merge SHA" /></label>
      <label>Release date <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></label>
      {f.status === "shipped" && <p>Shipped in {f.releaseSha?.slice(0, 7)} on {f.releaseAt && when(f.releaseAt)}</p>}
      {status === "shipped" && <label>Reply draft <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="A draft appears after you save the shipped status" /></label>}
      {error && <p role="alert">{error}</p>}
      <button className="button tinted" disabled={busy}>Save changes</button>
    </form>
    {f.status === "shipped" && !f.repliedAt && <div className="stack">
      {(f.source === "app" || f.source === "email") && <button className="button" disabled={busy || !draft.trim() || f.sending} onClick={() => reply("send")}>Send</button>}
      {f.source !== "app" && <>
        <label>Outside channel <select value={channel} onChange={(e) => setChannel(e.target.value)}>{["email", "linkedin", "whatsapp", "in_person", "other"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
        <button type="button" className="button" disabled={!draft.trim()} onClick={() => navigator.clipboard.writeText(draft)}>Copy reply</button>
        {f.sourceUrl && <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">Open the post</a>}
        <label>Link to your reply <input type="url" value={replyUrl} onChange={(e) => setReplyUrl(e.target.value)} placeholder="https://" /></label>
        <button className="button" disabled={busy || !draft.trim()} onClick={() => reply("mark")}>Mark as replied</button>
      </>}
    </div>}
    {f.repliedAt && <p>Reply sent: {f.replyText}</p>}
  </section>;
}

export function Ratings({ params, open, update }) {
  const rows = useQuery(api.admin.ratings, { verdict: params.verdict, reason: params.reason, band: params.band, userId: params.userId, watchId: params.watchId, minScore: num(params.minScore), ...useDateFilters(params), search: params.q });
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
  return <ListTable params={params} update={update} filter={{ watch: true, score: true, status: { key: "verdict", label: "Verdict", options: [["good", "Good match"], ["not_right", "Not right"]] } }} name="ratings" columns={cols} rows={rows?.rows} more={rows?.more} searchKeys={["title", "note", "email", "reason"]}
                onOpen={(r) => open({ view: "alert", title: r.title, params: { id: r.alertId } })} empty="No ratings here yet." />;
}

export function Runs({ params, open, update }) {
  const rows = useQuery(api.admin.runs, { ...useDateFilters(params), requestId: params.requestId, failed: params.status === "failed" ? true : undefined, search: params.q });
  return <ListTable params={params} update={update} filter={{ user: false, status: { key: "status", label: "Status", options: [["failed", "Failed"]] } }}
    name="runs" rows={rows?.rows} more={rows?.more} searchKeys={["requestId"]} columns={[
      { key: "at", label: "When", render: (r) => when(r.at) }, { key: "requestId", label: "Request ID" },
      { key: "checked", label: "Checked" }, { key: "failed", label: "Failed" },
      { key: "emails", label: "E-mails" }, { key: "emailFailures", label: "E-mail failures" },
      { key: "paused", label: "Paused", render: (r) => r.paused ? "Yes" : "No" },
    ]} onOpen={(r) => open({ view: "run", title: r.requestId ?? "Run", params: { id: r._id } })} />;
}

export function Errors({ params, open, update }) {
  const rows = useQuery(api.admin.errors, { ...useDateFilters(params), kind: params.kind, requestId: params.requestId, search: params.q });
  return <ListTable params={params} update={update} filter={{ user: false, status: { key: "kind", label: "Kind", options: [["chat", "Chat"], ["check", "Check"]] } }}
    name="errors" rows={rows?.rows} more={rows?.more} searchKeys={["requestId", "message", "kind"]} columns={[
      { key: "at", label: "When", render: (r) => when(r.at) }, { key: "kind", label: "Kind" },
      { key: "requestId", label: "Request ID" }, { key: "message", label: "Message" },
    ]} onOpen={(r) => open({ view: "error", title: r.requestId, params: { id: r._id } })} />;
}

export function Audits({ params, open, update }) {
  const rows = useQuery(api.admin.audits, { ...useDateFilters(params), userId: params.userId, watchId: params.watchId,
    kind: params.kind, minScore: num(params.minScore), requestId: params.requestId, search: params.q });
  return <ListTable params={params} update={update} filter={{ watch: true, score: true,
    status: { key: "kind", label: "Kind", options: [["handled", "Handled"], ["never_read", "Never read"], ["rescored", "Rescored"], ["never_scored", "Never scored"]] } }}
    name="delivery-audit" rows={rows?.rows} more={rows?.more} searchKeys={["title", "listingId", "requestId", "watch", "email"]} columns={[
      { key: "at", label: "When", render: (r) => when(r.at) }, { key: "title", label: "Listing", render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{r.title}</a> },
      { key: "score", label: "Score" }, { key: "kind", label: "Kind", nowrap: true },
      { key: "reportedBefore", label: "Reported", render: (r) => r.reportedBefore === undefined ? "New" : `reported before (${new Date(r.reportedBefore).toLocaleDateString("en-GB", { timeZone: "Europe/Amsterdam", day: "numeric", month: "short", year: "numeric" })})` },
      { key: "watch", label: "Watch" },
      { key: "email", label: "Account" }, { key: "requestId", label: "Request ID" },
    ]} onOpen={(r) => open({ view: "watch", title: r.watch, params: { id: r.watchId } })} />;
}

export function CatchUps({ params, open, update }) {
  const rows = useQuery(api.admin.alerts, { ...useDateFilters(params), userId: params.userId, watchId: params.watchId,
    minScore: num(params.minScore), emailStatus: params.emailStatus, catchUp: true, search: params.q });
  return <ListTable params={params} update={update} filter={{ watch: true, score: true, status: emailStatusOptions }}
    name="catch-ups" columns={alertCols()} rows={rows?.rows} more={rows?.more} searchKeys={["title", "listingId", "watch", "email"]}
    onOpen={(a) => open({ view: "alert", title: a.title, params: { id: a._id } })} />;
}

export function Operation({ params, view }) {
  const row = useQuery(api.admin.operation, view === "run" ? { runId: params.id } : { errorId: params.id });
  if (row === undefined) return <p className="hint">Loading…</p>;
  if (!row) return <p className="hint">Record not found.</p>;
  return <dl className="facts">{Object.entries(row).filter(([key]) => !key.startsWith("_")).map(([key, value]) =>
    <div key={key}><dt>{key}</dt><dd>{key === "at" ? when(value) : String(value ?? "–")}</dd></div>)}</dl>;
}

// ---------- Records ----------
function Facts({ items }) {
  return <dl className="facts">{items.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function User({ params, open }) {
  const u = useQuery(api.admin.user, { userId: params.id });
  const setBudget = useMutation(api.aiBudget.setUserBudget);
  const [budgetError, setBudgetError] = useState("");
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
          ["Last active", when(u.events[0]?.at ?? u.chats[0]?.updatedAt)],
          ["AI budget", `€${u.aiBudget.spentEur.toFixed(2)} / €${u.aiBudget.limitEur.toFixed(2)} · resets ${when(u.aiBudget.resetsAt)}`]]} />
      </div>
      <form className="admin-budget-form" onSubmit={async (e) => { e.preventDefault(); setBudgetError(""); const value = Number(new FormData(e.currentTarget).get("limit"));
        try { await setBudget({ userId: u._id, limitEur: value }); } catch (error) { setBudgetError(adminError(error)); } }}>
        <label>AI budget for this account (€) <input name="limit" type="number" min="0.01" max="100" step="0.01" defaultValue={u.aiBudget.limitEur} /></label>
        <button className="button tinted" type="submit">Save budget</button>
        {budgetError && <p role="alert">{budgetError}</p>}
      </form>
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
          Checking Marktplaats for <mark>{w.label}</mark> <mark>{w.schedule}</mark>, e-mailing <mark>{NOTIFY_LABEL[w.notify] ?? w.notify}</mark>{NOTIFY_SHORT[w.notify] && ` (${NOTIFY_SHORT[w.notify]})`}.
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

export const VIEWS = { users: Users, user: User, waitlist: Waitlist, watches: Watches, watch: Watch, alerts: Alerts, alert: Alert, chats: Chats,
  chat: Chat, events: Events, feedback: Feedback, day: Day, ratings: Ratings, runs: Runs, errors: Errors,
  audits: Audits, catchups: CatchUps, run: Operation, error: Operation, spend: OpenAiSpendView };
