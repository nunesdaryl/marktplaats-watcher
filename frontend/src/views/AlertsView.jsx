import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Skeleton from "../components/Skeleton.jsx";
import ListingCard from "../components/ListingCard.jsx";
import RateAlert from "../components/RateAlert.jsx";
import RatingNudge from "../components/RatingNudge.jsx";
import { useNow } from "../lib/router.js";

export default function AlertsView({ actions, watches, onNewWatch }) {
  const alerts = useQuery(api.watches.alerts);
  const ratings = useQuery(api.ratings.mine) ?? {};
  const me = useQuery(api.users.me);
  const now = useNow();
  const seenAt = useRef(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [archiving, setArchiving] = useState(false);
  if (seenAt.current === null && me) seenAt.current = me.alertsSeenAt ?? me.createdAt;
  // Keep the visit's first seen time while marking incoming alerts seen for the tab count.
  const markSeen = useMutation(api.users.markAlertsSeen);
  const newest = alerts?.[0]?._id;
  useEffect(() => {
    if (seenAt.current !== null && alerts !== undefined) markSeen().catch(() => {});
  }, [newest, alerts === undefined, seenAt.current === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!confirmAll) return;
    const id = setTimeout(() => setConfirmAll(false), 4000);
    return () => clearTimeout(id);
  }, [confirmAll]);

  const archiveAll = async () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setArchiving(true);
    try { await actions.archiveAllAlerts(); }
    finally { setArchiving(false); setConfirmAll(false); }
  };

  return (
    <section className="page" aria-labelledby="alerts-title">
      <header className="page-head">
        <div className="alerts-head-row">
          <h1 id="alerts-title">Alerts</h1>
          {alerts?.length > 0 && <button type="button" className="link-button" onClick={archiveAll}
                                        onBlur={() => setConfirmAll(false)} disabled={archiving}
                                        aria-busy={archiving}>
            {archiving ? "Archiving…" : confirmAll ? "Archive all alerts?" : "Archive all"}
          </button>}
        </div>
        <p className="muted">Every listing we e-mailed you, newest first, with its score and the reason for it. Tell us if
          it was a good match: every rating is read to check and improve the scores.</p>
      </header>
      <RatingNudge />
      {alerts === undefined || seenAt.current === null ? <Skeleton /> : alerts.length === 0 ? (
        <div className="empty-state">
          <p className="empty-note">When a watch finds a good new listing, its alert appears here and in your inbox.</p>
          {watches?.length === 0 && <button className="button tinted" onClick={onNewWatch}>Create a watch</button>}
        </div>
      ) : (
        <div className="cards grid">
          {alerts.map((a) => {
            const isNew = a.createdAt > seenAt.current;
            return <div key={a._id} className={`alert-item${isNew ? " is-new" : ""}`}>
              <ListingCard listing={{ ...a, price_eur: a.priceEur }} score={a.score} reason={a.reason} isNew={isNew}
                           meta={`${a.watchLabel} · ${describeWhen(a.createdAt, now)}`} />
              <RateAlert alertId={a._id} rating={ratings[a._id]}
                alert={{ ...a, query: watches?.find((w) => w._id === a.watchId)?.query ?? "",
                  mustInclude: watches?.find((w) => w._id === a.watchId)?.mustInclude ?? "",
                  notify: watches?.find((w) => w._id === a.watchId)?.notify ?? "good",
                  maxPriceEur: watches?.find((w) => w._id === a.watchId)?.maxPriceEur ?? null,
                  excludeWords: watches?.find((w) => w._id === a.watchId)?.excludeWords ?? [] }}
                onArchive={() => actions.archiveAlert(a._id)} />
            </div>;
          })}
        </div>
      )}
    </section>
  );
}
