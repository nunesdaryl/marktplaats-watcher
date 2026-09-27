import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Icon from "../components/Icon.jsx";
import ListingCard from "../components/ListingCard.jsx";
import WatchSentence from "../components/WatchSentence.jsx";
import { go, useNow } from "../lib/router.js";

/** Asks once more before something that can't be undone (no browser dialogs). */
export function ConfirmButton({ label, confirmLabel, onConfirm, icon }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(id);
  }, [asking]);
  return (
    <button className={`button ${asking ? "destructive" : ""}`} onClick={() => (asking ? onConfirm() : setAsking(true))}>
      {icon && <Icon name={icon} size={16} />}{asking ? confirmLabel : label}
    </button>
  );
}

export default function WatchView({ watch, onEdit }) {
  const update = useMutation(api.watches.update);
  const remove = useMutation(api.watches.remove);
  const checkNow = useMutation(api.watches.checkNow);
  const now = useNow();
  const [error, setError] = useState("");
  const run = (fn) => fn().then(() => setError("")).catch((e) => setError(e.data ?? "That didn't work. Try again."));

  if (watch === undefined) return <section className="page"><p className="muted">Loading…</p></section>;
  if (!watch) return (
    <section className="page"><h1>Watch not found</h1><p className="muted">It may have been deleted.</p></section>
  );

  let status;
  if (!watch.active) status = "Paused";
  else if (!watch.seeded) status = "Taking a first look at what's listed now…";
  else status = `Next check ${describeWhen(watch.nextRunAt, now)}`;

  return (
    <section className="page watch-page" aria-labelledby="watch-title">
      <header className="page-head">
        <h1 id="watch-title">{watch.label}</h1>
        <WatchSentence label={watch.label} schedule={watch.schedule} notify={watch.notify} paused={!watch.active} />
        <p className="muted">{status}{watch.lastCheckedAt ? ` · last checked ${describeWhen(watch.lastCheckedAt, now)}` : ""}</p>
        {watch.lastError && <p className="warn">{watch.lastError}</p>}
        <div className="actions">
          <button className="button" onClick={() => onEdit(watch)}><Icon name="edit" size={16} />Edit</button>
          <button className="button" onClick={() => run(() => update({ id: watch._id, active: !watch.active }))}>
            <Icon name={watch.active ? "pause" : "play"} size={16} />{watch.active ? "Pause" : "Resume"}
          </button>
          {watch.active && (
            <button className="button" onClick={() => run(() => checkNow({ id: watch._id }))}>
              <Icon name="refresh" size={16} />Check now
            </button>
          )}
          <ConfirmButton icon="trash" label="Delete" confirmLabel="Delete for good?"
                         onConfirm={() => run(async () => { await remove({ id: watch._id }); go("/watches"); })} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </header>

      <h2 className="section-title">Matches</h2>
      {watch.alerts.length ? (
        <div className="cards grid">
          {watch.alerts.map((a) => (
            <ListingCard key={a._id} listing={{ ...a, price_eur: a.priceEur }} score={a.score} reason={a.reason}
                         meta={describeWhen(a.createdAt, now)} />
          ))}
        </div>
      ) : (
        <p className="empty-note">{watch.seeded
          ? "No new matches yet. You'll get an e-mail as soon as a good one appears."
          : "The first check is running. It only notes what's listed now, so you only hear about new ones."}</p>
      )}
    </section>
  );
}
