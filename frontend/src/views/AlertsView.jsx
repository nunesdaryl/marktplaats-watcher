import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Skeleton from "../components/Skeleton.jsx";
import ListingCard from "../components/ListingCard.jsx";
import RateAlert from "../components/RateAlert.jsx";
import { useNow } from "../lib/router.js";

export default function AlertsView() {
  const alerts = useQuery(api.watches.alerts);
  const ratings = useQuery(api.ratings.mine) ?? {};
  const now = useNow();
  // Seeing the page clears the count on the Alerts tab, also for alerts that arrive while it's open
  const markSeen = useMutation(api.users.markAlertsSeen);
  const newest = alerts?.[0]?._id;
  useEffect(() => { if (alerts !== undefined) markSeen().catch(() => {}); }, [newest, alerts === undefined]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="page" aria-labelledby="alerts-title">
      <header className="page-head">
        <h1 id="alerts-title">Alerts</h1>
        <p className="muted">Every listing we e-mailed you, newest first, with its score and the reason for it. Tell us if
          it was a good match: every rating is read to check and improve the scores.</p>
      </header>
      {alerts === undefined ? <Skeleton /> : alerts.length === 0 ? (
        <p className="empty-note">No alerts yet. When a watch finds a good new listing, it shows up here and in your inbox.</p>
      ) : (
        <div className="cards grid">
          {alerts.map((a) => (
            <div key={a._id} className="alert-item">
              <ListingCard listing={{ ...a, price_eur: a.priceEur }} score={a.score} reason={a.reason}
                           meta={`${a.watchLabel} · ${describeWhen(a.createdAt, now)}`} />
              <RateAlert alertId={a._id} rating={ratings[a._id]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
