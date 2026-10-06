import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Icon from "../components/Icon.jsx";
import Skeleton from "../components/Skeleton.jsx";
import ListingCard from "../components/ListingCard.jsx";
import RowMenu from "../components/RowMenu.jsx";
import WatchSentence from "../components/WatchSentence.jsx";
import BroadWatchWarning from "../components/BroadWatchWarning.jsx";
import { go, useNow } from "../lib/router.js";
import { track } from "../lib/track.js";

/** Asks once more before something that can't be undone (no browser dialogs). */
export function ConfirmButton({ label, confirmLabel, onConfirm, icon }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(id);
  }, [asking]);
  return (
    // Sieve Button spec: the first step says it in red text, the confirm step is the red button
    <button className={`button ${asking ? "destructive" : "danger-text"}`} onClick={() => (asking ? onConfirm() : setAsking(true))}>
      {icon && <Icon name={icon} size={18} />}{asking ? confirmLabel : label}
    </button>
  );
}

export default function WatchView({ watch, onEdit, actions }) {
  const update = useMutation(api.watches.update);
  const checkNow = useMutation(api.watches.checkNow);
  const now = useNow();
  const [error, setError] = useState("");
  const run = (fn) => fn().then(() => setError("")).catch((e) => setError(e.data ?? "That didn't work. Try again."));

  if (watch === undefined) return <section className="page"><Skeleton /></section>;
  if (!watch) return (
    <section className="page"><h1>Watch not found</h1><p className="muted">It may have been deleted.</p></section>
  );

  let status;
  if (watch.archivedAt) status = "Archived and paused";
  else if (!watch.active) status = "Paused";
  else if (!watch.seeded) status = "Taking a first look at what's listed now…";
  else status = `Next check ${describeWhen(watch.nextRunAt, now)}`;

  return (
    <section className="page watch-page" aria-labelledby="watch-title">
      <header className="page-head">
        <div className="title-row">
          <h1 id="watch-title">{watch.title}</h1>
          <RowMenu items={actions.watchItems(watch, { full: true })} label="Watch options" className="large" />
        </div>
        {watch.pinned && <span className="pill">Pinned</span>}
        <WatchSentence label={watch.label} schedule={watch.schedule} notify={watch.notify} paused={!watch.active} />
        <p className="muted watch-times">{status}{watch.lastCheckedAt ? ` · last checked ${describeWhen(watch.lastCheckedAt, now)}` : ""}</p>
        {watch.lastError && <p className="warn">{watch.lastError}</p>}
        {watch.active && !watch.archivedAt && ((watch.backlog ?? 0) >= 20 || watch.coverageCapped) &&
          <BroadWatchWarning message={`This watch is falling behind${watch.backlog > 0 ? ` (${watch.backlog} listings waiting)` : ""}. Add a brand, model or price limit, or choose 'good matches'.`}
            onPrice={() => onEdit({ ...watch, focusMaxPrice: true })}
            onGood={() => run(() => update({ id: watch._id, notify: "good" }))} showGood={watch.notify !== "good"} />}
        <div className="actions">
          <button className="button" onClick={() => onEdit(watch)}><Icon name="edit" size={18} />Edit</button>
          {!watch.archivedAt && (
            <button className="button" onClick={() => run(() => update({ id: watch._id, active: !watch.active }).then(() => track(watch.active ? "watch_paused" : "watch_resumed")))}>
              <Icon name={watch.active ? "pause" : "play"} size={18} />{watch.active ? "Pause" : "Resume"}
            </button>
          )}
          {watch.active && (
            <button className="button" onClick={() => run(() => checkNow({ id: watch._id }))}>
              <Icon name="refresh" size={18} />Check now
            </button>
          )}
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
          ? "No good ones yet. Every check reads the new listings and only keeps the ones that fit; when one does, we'll e-mail you."
          : "The first check is running. It only notes what's listed now, so you only hear about new ones."}</p>
      )}
    </section>
  );
}
