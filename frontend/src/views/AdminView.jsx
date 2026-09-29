import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import Icon from "../components/Icon.jsx";

// Visitors and page views, including people who never signed in, are counted by Vercel Web Analytics
const VERCEL_ANALYTICS = "https://vercel.com/daryl-nunes-projects/marktplaats-watcher/analytics";

const when = (t) => new Date(t).toLocaleString("en-GB", { timeZone: "Europe/Amsterdam", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const LABELS = {
  page_view: "Page views", chat_sent: "Chat messages", chip_clicked: "Suggestion chips", watch_saved: "Watches saved",
  watch_paused: "Watches paused", watch_resumed: "Watches resumed", watch_deleted: "Watches deleted",
  watch_archived: "Watches archived", alert_opened: "Alerts opened", listing_opened: "Listings opened",
  feedback_opened: "Feedback opened", feedback_sent: "Feedback sent", theme_changed: "Theme switched",
  onboarding_done: "Setup finished", history_opened: "Chat history opened",
  "": "Chat", c: "A chat", w: "A watch", watches: "Watches", alerts: "Alerts", archived: "Archived", admin: "Dashboard", chat: "New chat",
};
const label = (name) => LABELS[name] ?? name;

function Stat({ value, name, note }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-name">{name}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

/** Daily bars: one column per day, the busiest day is full height. */
function DayChart({ title, daily, keys }) {
  const total = (d) => keys.reduce((n, k) => n + d[k.key], 0);
  const max = Math.max(1, ...daily.map(total));
  const sum = daily.reduce((n, d) => n + total(d), 0);
  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span><span className="chart-sum">{sum}</span>
      </figcaption>
      <div className="bars" role="img" aria-label={`${title}: ${sum} in ${daily.length} days`}>
        {daily.map((d) => (
          <div key={d.day} className="bar-col" title={`${shortDay(d.day)}: ${keys.map((k) => `${d[k.key]} ${k.name}`).join(", ")}`}>
            {keys.map((k) => d[k.key] > 0 && (
              <span key={k.key} className={`bar ${k.tone ?? ""}`} style={{ height: `${(d[k.key] / max) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="chart-axis"><span>{shortDay(daily[0].day)}</span><span>{shortDay(daily.at(-1).day)}</span></div>
      {keys.length > 1 && (
        <div className="legend">{keys.map((k) => <span key={k.key}><i className={`swatch ${k.tone ?? ""}`} />{k.name}</span>)}</div>
      )}
    </figure>
  );
}

/** A ranked list with a bar per row, relative to the biggest. */
function Breakdown({ title, rows, empty = "Nothing yet" }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const sum = rows.reduce((n, r) => n + r.count, 0);
  return (
    <section className="breakdown">
      <h3>{title}</h3>
      {rows.length === 0 || sum === 0 ? <p className="hint">{empty}</p> : (
        <ul>
          {rows.map((r) => (
            <li key={r.name}>
              <span className="breakdown-name">{label(r.name)}</span>
              <span className="breakdown-bar"><span style={{ width: `${(r.count / max) * 100}%` }} /></span>
              <span className="breakdown-count">{r.count}<small>{Math.round((r.count / sum) * 100)}%</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Funnel({ steps }) {
  const top = Math.max(1, steps[0].count);
  return (
    <ol className="funnel">
      {steps.map((s, i) => (
        <li key={s.step}>
          <span className="funnel-bar" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
          <span className="funnel-step">{s.step}</span>
          <span className="funnel-count">{s.count}<small>{i === 0 ? "" : `${Math.round((s.count / top) * 100)}%`}</small></span>
        </li>
      ))}
    </ol>
  );
}

function FeedbackItem({ f }) {
  const c = f.context;
  return (
    <li className="fb">
      <div className="fb-head">
        <span className="fb-when">{when(f.createdAt)}</span>
        <span className="fb-from">{f.email}</span>
        {f.wouldPay && <span className="pill">{f.wouldPay}</span>}
      </div>
      <div className="fb-body">
        <div className="fb-text">
          <p className="fb-message">{f.message ?? <span className="muted">(no message, only the would-pay answer)</span>}</p>
          <p className="fb-meta">
            {c ? <>{c.path} · {c.device} {c.viewport} · {c.theme} · {c.browser ?? "?"}{c.version ? ` · ${c.version}` : ""}</> : `Page: ${f.page ?? "?"}`}
          </p>
          {c?.errors?.length > 0 && (
            <details className="fb-errors" open>
              <summary>{c.errors.length} recent error{c.errors.length > 1 ? "s" : ""}</summary>
              <ul>{c.errors.map((e, i) => <li key={i}><code>{e}</code></li>)}</ul>
            </details>
          )}
          {f.before.length > 0 && (
            <details className="fb-before">
              <summary>What they did before ({f.before.length})</summary>
              <ol>{f.before.map((e, i) => (
                <li key={i}><span className="mono">{new Date(e.at).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" })}</span>
                  {label(e.name)}{e.props ? ` · ${Object.values(e.props).filter(Boolean).map(label).join(" · ")}` : ""}</li>
              ))}</ol>
            </details>
          )}
        </div>
        {f.screenshotUrl ? (
          <a className="fb-shot" href={f.screenshotUrl} target="_blank" rel="noopener noreferrer" title="Open the screenshot full size">
            <img src={f.screenshotUrl} alt={`Screenshot of ${c?.path ?? "the page"} when the feedback was sent`} loading="lazy" />
          </a>
        ) : <span className="fb-shot none">No screenshot</span>}
      </div>
    </li>
  );
}

/** The owner's dashboard: how the app is used, where people drop off, what they say, and whether it's healthy. */
export default function AdminView() {
  const [days, setDays] = useState(30);
  const owner = useQuery(api.admin.amOwner);
  const data = useQuery(api.admin.dashboard, owner ? { days } : "skip");
  const feedback = useQuery(api.admin.feedback, owner ? {} : "skip");

  if (owner === false) return null;   // App.jsx only mounts this for the owner; the server returns no data to anyone else
  if (!data) return <section className="page"><p className="hint" role="status">Loading the dashboard…</p></section>;

  const t = data.totals;
  const h = data.health;
  return (
    <section className="page admin" aria-label="Owner dashboard">
      <div className="page-head admin-head">
        <h1>Dashboard</h1>
        <div className="segmented" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? "active" : ""} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>

      <div className={`health ${h.problems.length ? "bad" : "ok"}`} role="status">
        <strong>{h.problems.length ? `${h.problems.length} problem${h.problems.length > 1 ? "s" : ""}` : "All healthy"}</strong>
        <span>{h.summary}{h.lastRunAt ? ` Last check run ${when(h.lastRunAt)}.` : ""}</span>
        {h.problems.map((p) => <span key={p} className="health-problem">{p}</span>)}
      </div>

      <div className="stats">
        <Stat value={t.users} name="Accounts" note={`+${t.newUsers7d} this week`} />
        <Stat value={t.active1d} name="Active today" note={`${t.active7d} this week · ${t.active30d} in 30 days`} />
        <Stat value={t.watchesActive} name="Active watches" note={`${t.watchesPaused} paused · ${t.watchesArchived} archived`} />
        <Stat value={t.alerts7d} name="Alerts this week" note={`${t.alerts} kept · ${t.emailsFailed} e-mails failed`} />
        <Stat value={t.chats} name="Saved chats" note="kept 30 days after last use" />
        <Stat value={t.feedback} name="Feedback" note={<a href="#feedback">Read it ↓</a>} />
      </div>

      <div className="charts">
        <DayChart title="Active people" daily={data.daily} keys={[{ key: "active", name: "people" }]} />
        <DayChart title="Chat messages" daily={data.daily}
                  keys={[{ key: "searches", name: "Search now" }, { key: "watchChats", name: "Watch it", tone: "tag" }]} />
        <DayChart title="Watches created" daily={data.daily} keys={[{ key: "watches", name: "watches" }]} />
        <DayChart title="Alerts found" daily={data.daily} keys={[{ key: "alerts", name: "alerts", tone: "great" }]} />
      </div>

      <section className="panel">
        <h2>From sign-up to first alert</h2>
        <p className="hint">Every account so far. Where the bar drops is where people get stuck.</p>
        <Funnel steps={data.funnel} />
      </section>

      <div className="breakdowns">
        <Breakdown title={`What people do (${days} days)`} rows={data.features} />
        <Breakdown title="Pages visited" rows={data.pages} />
        <Breakdown title="Search now vs Watch it" rows={data.chatModes} />
        <Breakdown title="Phone vs desktop" rows={data.devices} />
        <Breakdown title="Light vs dark" rows={data.themes} />
        <Breakdown title="Schedules of active watches" rows={data.schedules} />
        <Breakdown title="Which alerts they want" rows={data.notify.map((r) => ({ ...r, name: { great: "Great matches only", good: "Good matches", all: "Every new listing" }[r.name] ?? r.name }))} />
        <Breakdown title="Would you pay for this?" rows={data.wouldPay} empty="No answers yet" />
      </div>

      <section className="panel" id="feedback">
        <h2>Feedback and suggestions</h2>
        {feedback === undefined ? <p className="hint">Loading…</p> : feedback.length === 0 ? (
          <p className="hint">Nothing yet. It arrives here and in your inbox.</p>
        ) : <ul className="fb-list">{feedback.map((f) => <FeedbackItem key={f._id} f={f} />)}</ul>}
      </section>

      <p className="hint admin-foot">
        Usage is recorded for signed-in people only and kept 90 days; nothing they type is recorded.
        Visitors who never sign in, and where they come from: <a href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer">Vercel
        Web Analytics <Icon name="external" size={13} /></a>.{data.capped ? " Showing the latest 20,000 events only." : ""}
      </p>
    </section>
  );
}
