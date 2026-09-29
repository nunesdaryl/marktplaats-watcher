// The dashboard overview. Every number, bar, funnel step and breakdown row is a door: it opens the exact records
// behind it in the drilldown panel (Views.jsx).
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import Icon from "../../components/Icon.jsx";
import { DAY, dayLabel, label, when } from "./nav.js";

const shortDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const NOTIFY = { great: "Great matches only", good: "Good matches", all: "Every new listing" };
const FUNNEL_KEYS = ["signed_up", "setup", "chatted", "watch", "alert"];

function Stat({ value, name, note, onOpen }) {
  return (
    <button className="stat door" onClick={onOpen} onDoubleClick={onOpen} title={`Show the ${name.toLowerCase()}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-name">{name}<Icon name="chevron" size={14} /></span>
      {note && <span className="stat-note">{note}</span>}
    </button>
  );
}

/** Daily bars: one column per day, the busiest day is full height. Each day opens that day's records. */
function DayChart({ title, daily, keys, onDay, onTitle, hideSum }) {
  const total = (d) => keys.reduce((n, k) => n + d[k.key], 0);
  const max = Math.max(1, ...daily.map(total));
  const sum = daily.reduce((n, d) => n + total(d), 0);
  return (
    <figure className="chart">
      <figcaption>
        {onTitle ? <button className="link-button strong" onClick={onTitle}>{title}<Icon name="chevron" size={13} /></button> : <span>{title}</span>}
        {!hideSum && <span className="chart-sum">{sum}</span>}
      </figcaption>
      <div className="bars" role="group" aria-label={`${title}: ${sum} in ${daily.length} days`}>
        {daily.map((d) => (
          <button key={d.day} className="bar-col" disabled={!onDay} onClick={() => onDay?.(d.day)}
                  title={`${dayLabel(d.day)}: ${keys.map((k) => `${d[k.key]} ${k.name}`).join(", ")}`}
                  aria-label={`${dayLabel(d.day)}: ${keys.map((k) => `${d[k.key]} ${k.name}`).join(", ")}`}>
            {keys.map((k) => d[k.key] > 0 && (
              <span key={k.key} className={`chart-bar ${k.tone ?? ""}`} style={{ height: `${(d[k.key] / max) * 100}%` }} />
            ))}
          </button>
        ))}
      </div>
      <div className="chart-axis"><span>{shortDay(daily[0].day)}</span><span>{shortDay(daily.at(-1).day)}</span></div>
      {keys.length > 1 && (
        <div className="legend">{keys.map((k) => <span key={k.key}><i className={`swatch ${k.tone ?? ""}`} />{k.name}</span>)}</div>
      )}
    </figure>
  );
}

/** A ranked list with a bar per row, relative to the biggest; rows open their records when onRow is given. */
function Breakdown({ title, rows, empty = "Nothing yet", onRow, value = (r) => r.count, note }) {
  const max = Math.max(1, ...rows.map(value));
  const sum = rows.reduce((n, r) => n + value(r), 0);
  return (
    <section className="breakdown">
      <h3>{title}</h3>
      {rows.length === 0 || sum === 0 ? <p className="hint">{empty}</p> : (
        <ul>
          {rows.map((r) => {
            const body = (
              <>
                <span className="breakdown-name">{r.label ?? label(r.name)}</span>
                <span className="breakdown-bar"><span style={{ width: `${(value(r) / max) * 100}%` }} /></span>
                <span className="breakdown-count">{value(r)}<small>{Math.round((value(r) / sum) * 100)}%</small></span>
              </>
            );
            return <li key={r.key ?? r.name}>{onRow && value(r) > 0 ? <button className="door-row" onClick={() => onRow(r)}>{body}</button> : <div className="door-row still">{body}</div>}</li>;
          })}
        </ul>
      )}
      {note && <p className="breakdown-note">{note}</p>}
    </section>
  );
}

function Funnel({ steps, onStep }) {
  const top = Math.max(1, steps[0].count);
  return (
    <ol className="funnel">
      {steps.map((s, i) => {
        const lost = i > 0 ? Math.max(0, steps[i - 1].count - s.count) : 0;
        return (
          <li key={s.step}>
            <button className="funnel-main" onClick={() => onStep(FUNNEL_KEYS[i], s.step, false)}>
              <span className="funnel-bar" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
              <span className="funnel-step">{s.step}</span>
              <span className="funnel-count">{s.count}<small>{i === 0 ? "" : `${Math.round((s.count / top) * 100)}%`}</small></span>
            </button>
            {lost > 0 && (
              <button className="funnel-lost" onClick={() => onStep(FUNNEL_KEYS[i], s.step, true)} title="The people who stopped here">
                {lost} stopped here
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function FeedbackItem({ f, action, onPerson }) {
  const c = f.context;
  return (
    <li className={`fb ${f.handledAt ? "handled" : ""}`}>
      <div className="fb-head">
        <span className="fb-when">{when(f.createdAt)}</span>
        {onPerson ? <button className="link-button fb-from" onClick={onPerson}>{f.email}</button> : <span className="fb-from">{f.email}</span>}
        {f.wouldPay && <span className="pill">{f.wouldPay}</span>}
        {f.handledAt && <span className="status-pill sent">handled</span>}
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
          {f.before?.length > 0 && (
            <details className="fb-before">
              <summary>What they did before ({f.before.length})</summary>
              <ol>{f.before.map((e, i) => (
                <li key={i}><span className="mono">{new Date(e.at).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" })}</span>
                  {label(e.name)}{e.props ? ` · ${Object.values(e.props).filter(Boolean).map(label).join(" · ")}` : ""}</li>
              ))}</ol>
            </details>
          )}
          {action && <div className="fb-actions">{action}</div>}
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

/** Website visitors from Vercel Web Analytics (cookieless; includes people who never signed in). */
function Visitors({ days }) {
  const load = useAction(api.analytics.webAnalytics);
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let live = true;
    setData(undefined);
    load({ days }).then((d) => { if (live) setData(d); }).catch(() => { if (live) setData({ status: "error", message: "Couldn't reach Vercel." }); });
    return () => { live = false; };
  }, [days, load]);
  if (data === undefined) return <section className="panel"><h2>Website visitors</h2><p className="hint" role="status">Asking Vercel…</p></section>;
  if (!data) return null;
  if (data.status !== "ok") return <section className="panel"><h2>Website visitors</h2><p className="hint">{data.message}</p></section>;
  const b = data.breakdowns;
  const rows = (list) => list.map((r) => ({ name: r.name, label: r.name, count: r.visitors, pageviews: r.pageviews }));
  return (
    <section className="panel visitors">
      <h2>Website visitors <span className="hint">Vercel Web Analytics · everyone, signed in or not · no cookies</span></h2>
      <div className="stats">
        <div className="stat"><span className="stat-value">{data.visitors}</span><span className="stat-name">Visitors</span><span className="stat-note">unique, last {days} days</span></div>
        <div className="stat"><span className="stat-value">{data.pageviews}</span><span className="stat-name">Page views</span><span className="stat-note">{data.visitors ? (data.pageviews / data.visitors).toFixed(1) : 0} per visitor</span></div>
      </div>
      <div className="charts one">
        <DayChart title="Visitors and page views per day" hideSum daily={data.daily.map((d) => ({ ...d }))}
                  keys={[{ key: "visitors", name: "visitors" }, { key: "pageviews", name: "page views", tone: "tag" }]} />
      </div>
      <div className="breakdowns">
        <Breakdown title="Top pages (visitors)" rows={rows(b.pages)} />
        <Breakdown title="Where they came from" rows={rows(b.referrers)} note="(direct) = typed in, a bookmark, or an app that hides the source" />
        <Breakdown title="Countries" rows={rows(b.countries)} />
        <Breakdown title="Devices" rows={rows(b.devices)} />
        <Breakdown title="Browsers" rows={rows(b.browsers)} />
        <Breakdown title="Operating systems" rows={rows(b.systems)} />
      </div>
    </section>
  );
}

/** Are the scores right? What users said when they rated their alerts (convex/ratings.ts). */
function ScoreAccuracy({ days, go }) {
  const s = useQuery(api.admin.ratingStats, { days });
  if (!s) return null;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  return (
    <section className="panel">
      <h2>Are the scores right? <span className="hint">from people rating their alerts</span></h2>
      {s.rated === 0 ? (
        <p className="hint">No ratings yet. Every alert (in the e-mail and on the Alerts page) now asks "Good match? 👍 / 👎";
          answers arrive here.</p>
      ) : (
        <>
          <div className="stats">
            <Stat value={s.rated} name="Ratings" note={`${pct(s.rated, s.alertsSent)} of ${s.alertsSent} alerts sent · ${s.fromEmail} from e-mail`}
                  onOpen={() => go("ratings", "All ratings")} />
            <Stat value={pct(s.good, s.rated)} name="Said good match" note={`${s.good} 👍`} onOpen={() => go("ratings", "Rated good match", { verdict: "good" })} />
            <Stat value={s.notRight} name="Said not right" note={`${s.withNote} with a note`} onOpen={() => go("ratings", "Rated not right", { verdict: "not_right" })} />
            <Stat value={s.goodCouldBeGreat} name="👍 on a 6–7" note="could have been great: threshold hint"
                  onOpen={() => go("ratings", "Good matches users liked", { verdict: "good", band: "good" })} />
          </div>
          <div className="breakdowns">
            <section className="breakdown">
              <h3>Do users agree, per score band?</h3>
              <table className="band-table">
                <thead><tr><th>Scored</th><th>Rated</th><th>👍</th><th>👎</th><th>Agree</th></tr></thead>
                <tbody>
                  {s.bands.map((b) => (
                    <tr key={b.key} className={b.rated ? "openable" : ""} tabIndex={b.rated ? 0 : undefined}
                        onClick={b.rated ? () => go("ratings", `Rated alerts: ${b.label}`, { band: b.key }) : undefined}
                        onKeyDown={b.rated ? (e) => { if (e.key === "Enter") go("ratings", `Rated alerts: ${b.label}`, { band: b.key }); } : undefined}>
                      <td>{b.label}</td><td className="num">{b.rated}</td><td className="num">{b.good}</td>
                      <td className="num">{b.notRight}</td><td className="num strong">{pct(b.good, b.rated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="breakdown-note">Agree = share of 👍. Low agreement on 8–10 means the scorer over-promises.</p>
            </section>
            <Breakdown title="Why not right" rows={s.reasons} empty="Nobody gave a reason yet"
              onRow={(r) => go("ratings", `Not right: ${r.name}`, { reason: r.key })} />
          </div>
        </>
      )}
    </section>
  );
}

/** The overview. `open(view)` starts a drilldown. */
export default function Overview({ open }) {
  const [days, setDays] = useState(30);
  const data = useQuery(api.admin.dashboard, { days });
  const feedback = useQuery(api.admin.feedback, { limit: 5 });
  if (!data) return <section className="page"><p className="hint" role="status">Loading the dashboard…</p></section>;

  const t = data.totals;
  const h = data.health;
  const now = data.now;
  const since = now - days * DAY;
  const go = (view, title, params = {}) => open({ view, title, params }, { fresh: true });
  const openDay = (day) => go("day", dayLabel(day), { day });
  const eventsOf = (title, params) => go("events", title, { since, ...params });
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
      <p className="hint admin-tip">Click any number, bar or row to see the exact records behind it.</p>

      <div className={`health ${h.problems.length ? "bad" : "ok"}`} role="status">
        <strong>{h.problems.length ? `${h.problems.length} problem${h.problems.length > 1 ? "s" : ""}` : "All healthy"}</strong>
        <span>{h.summary}{h.lastRunAt ? ` Last check run ${when(h.lastRunAt)}.` : ""}</span>
        {h.problems.map((p) => <span key={p} className="health-problem">{p}</span>)}
      </div>

      <div className="stats">
        <Stat value={t.users} name="Accounts" note={`+${t.newUsers7d} this week`} onOpen={() => go("users", "Accounts")} />
        <Stat value={t.active1d} name="Active today" note={`${t.active7d} this week · ${t.active30d} in 30 days`}
              onOpen={() => go("users", "Active in the last 24 hours", { activeSince: now - DAY })} />
        <Stat value={t.watchesActive} name="Active watches" note={`${t.watchesPaused} paused · ${t.watchesArchived} archived`}
              onOpen={() => go("watches", "Watches", { status: "active" })} />
        <Stat value={t.alerts7d} name="Alerts this week" note={`${t.alerts} kept · ${t.emailsFailed} e-mails failed`}
              onOpen={() => go("alerts", "Alerts this week", { since: now - 7 * DAY })} />
        <Stat value={t.chats} name="Saved chats" note="kept 30 days after last use" onOpen={() => go("chats", "Saved chats")} />
        <Stat value={t.feedback} name="Feedback" note="with screenshots" onOpen={() => go("feedback", "Feedback and suggestions")} />
      </div>

      <div className="charts">
        <DayChart title="Active people" daily={data.daily} keys={[{ key: "active", name: "people" }]} onDay={openDay}
                  onTitle={() => go("users", `Active in the last ${days} days`, { activeSince: since })} />
        <DayChart title="Chat messages" daily={data.daily} onDay={openDay}
                  keys={[{ key: "searches", name: "Search now" }, { key: "watchChats", name: "Watch it", tone: "tag" }]}
                  onTitle={() => eventsOf("Chat messages", { name: "chat_sent" })} />
        <DayChart title="Watches created" daily={data.daily} keys={[{ key: "watches", name: "watches" }]} onDay={openDay}
                  onTitle={() => go("watches", `Watches created in the last ${days} days`, { createdSince: since })} />
        <DayChart title="Alerts found" daily={data.daily} keys={[{ key: "alerts", name: "alerts", tone: "great" }]} onDay={openDay}
                  onTitle={() => go("alerts", `Alerts in the last ${days} days`, { since })} />
      </div>

      <section className="panel">
        <h2>From sign-up to first alert</h2>
        <p className="hint">Every account so far. Click a step for who got there, or "stopped here" for who didn't.</p>
        <Funnel steps={data.funnel} onStep={(key, step, stuck) =>
          go("users", stuck ? `Stopped before "${step}"` : `Reached "${step}"`, stuck ? { stuck: key } : { stage: key })} />
      </section>

      <div className="breakdowns">
        <Breakdown title={`What people do (${days} days)`} rows={data.features} onRow={(r) => eventsOf(label(r.name), { name: r.name })} />
        <Breakdown title="Pages visited" rows={data.pages} onRow={(r) => eventsOf(`Page views: ${label(r.name)}`, { name: "page_view", section: r.name })} />
        <Breakdown title="Search now vs Watch it" rows={data.chatModes.map((r) => ({ ...r, label: r.name === "watch" ? "Watch it" : "Search now" }))}
                   onRow={(r) => eventsOf(r.label, { name: "chat_sent", mode: r.name })} />
        <Breakdown title="Phone vs desktop" rows={data.devices} onRow={(r) => eventsOf(`On ${r.name}`, { device: r.name })} />
        <Breakdown title="Light vs dark" rows={data.themes} onRow={(r) => eventsOf(`Pages seen in ${r.name} mode`, { name: "page_view", value: r.name })} />
        <Breakdown title="Schedules of active watches" rows={data.schedules} onRow={(r) => go("watches", `Watches checked ${r.name}`, { scheduleKey: r.name })} />
        <Breakdown title="Which alerts they want" rows={data.notify.map((r) => ({ ...r, label: NOTIFY[r.name] ?? r.name }))}
                   onRow={(r) => go("watches", `Watches e-mailing ${r.label.toLowerCase()}`, { notify: r.name })} />
        <Breakdown title="Would you pay for this?" rows={data.wouldPay} empty="No answers yet"
                   onRow={(r) => go("feedback", `Would pay: ${r.name}`, { wouldPay: r.key })} />
      </div>

      <ScoreAccuracy days={days} go={go} />

      <Visitors days={days} />

      <section className="panel" id="feedback">
        <h2>
          <button className="link-button strong" onClick={() => go("feedback", "Feedback and suggestions")}>
            Latest feedback<Icon name="chevron" size={14} />
          </button>
        </h2>
        {feedback === undefined ? <p className="hint">Loading…</p> : feedback.length === 0 ? (
          <p className="hint">Nothing yet. It arrives here and in your inbox.</p>
        ) : <ul className="fb-list">{feedback.map((f) => <FeedbackItem key={f._id} f={f}
              onPerson={() => open({ view: "user", title: f.email, params: { id: f.userId } }, { fresh: true })} />)}</ul>}
      </section>

      <p className="hint admin-foot">
        Usage is recorded for signed-in people only and kept 90 days; nothing they type is recorded in usage events.
        {data.capped ? " Showing the latest 20,000 events only." : ""}
      </p>
    </section>
  );
}
