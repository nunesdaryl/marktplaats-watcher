import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { NOTIFY_LABEL, describeWhen } from "../convex/schedule";

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** A button that asks once more before doing something that can't be undone (no browser dialogs). */
function ConfirmButton({ label, confirmLabel, onConfirm }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(id);
  }, [asking]);
  return (
    <button className={asking ? "danger" : "ghost"} onClick={() => (asking ? onConfirm() : setAsking(true))}>
      {asking ? confirmLabel : label}
    </button>
  );
}

function Watch({ w, now, onEdit }) {
  const update = useMutation(api.watches.update);
  const remove = useMutation(api.watches.remove);
  const checkNow = useMutation(api.watches.checkNow);
  const [error, setError] = useState("");
  const run = (fn) => fn().then(() => setError("")).catch((e) => setError(e.data ?? "That didn't work. Try again."));

  let status;
  if (!w.active) status = "Paused.";
  else if (!w.seeded) status = "Taking a first look at what's listed now…";
  else status = `Next check ${describeWhen(w.nextRunAt, now)}.`;

  return (
    <li className={`watch ${w.active ? "" : "paused"}`}>
      <h3>{w.label}</h3>
      <p className="meta">Checked {w.summary}; e-mails {NOTIFY_LABEL[w.notify]}. {status}</p>
      {w.lastCheckedAt && <p className="meta">Last checked {describeWhen(w.lastCheckedAt, now)}.</p>}
      {w.lastError && <p className="warn">{w.lastError}</p>}

      {w.alerts.length > 0 ? (
        <ul className="alerts" aria-label="Latest matches">
          {w.alerts.map((a) => (
            <li key={a._id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
              <span className="facts">
                {[a.priceEur && `€${a.priceEur}`, a.city, a.score !== undefined && `${a.score}/10`].filter(Boolean).join(", ")}
              </span>
              <span className="reason">{a.reason}</span>
            </li>
          ))}
        </ul>
      ) : w.seeded && <p className="meta">No new matches yet.</p>}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={() => onEdit(w)}>Edit</button>
        <button className="ghost" onClick={() => run(() => update({ id: w._id, active: !w.active }))}>
          {w.active ? "Pause" : "Resume"}
        </button>
        <button className="ghost" onClick={() => run(() => checkNow({ id: w._id }))}>Check now</button>
        <ConfirmButton label="Delete" confirmLabel="Delete for good?" onConfirm={() => run(() => remove({ id: w._id }))} />
      </div>
    </li>
  );
}

export default function Watches({ watches, onEdit }) {
  const now = useNow();
  const me = useQuery(api.users.me);
  const deleteMyData = useMutation(api.users.deleteMyData);

  return (
    <aside className="watches" aria-label="Your watches">
      <h2>Your watches</h2>
      {watches.length === 0 ? (
        <p className="empty-watches">
          Nothing watched yet. Search in the chat and press <strong>Watch this search</strong>, or just say
          "tell me when a cheap Mac mini shows up".
        </p>
      ) : (
        <ul className="watch-list">{watches.map((w) => <Watch key={w._id} w={w} now={now} onEdit={onEdit} />)}</ul>
      )}
      <footer className="account">
        {me && <p>Alerts go to <strong>{me.email}</strong>.</p>}
        <p>
          We keep your e-mail, watches and the listings already shown to you (30 days).{" "}
          <ConfirmButton label="Delete my data" confirmLabel="Delete everything?" onConfirm={() => deleteMyData()} />
        </p>
      </footer>
    </aside>
  );
}
