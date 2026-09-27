import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import ListingCard from "../components/ListingCard.jsx";
import { useNow } from "../lib/router.js";

export default function AlertsView() {
  const alerts = useQuery(api.watches.alerts);
  const now = useNow();
  return (
    <section className="page" aria-labelledby="alerts-title">
      <header className="page-head">
        <h1 id="alerts-title">Alerts</h1>
        <p className="muted">Every listing we e-mailed you, newest first, with its score and the reason for it.</p>
      </header>
      {alerts === undefined ? <p className="muted">Loading…</p> : alerts.length === 0 ? (
        <p className="empty-note">No alerts yet. When a watch finds a good new listing, it shows up here and in your inbox.</p>
      ) : (
        <div className="cards grid">
          {alerts.map((a) => (
            <ListingCard key={a._id} listing={{ ...a, price_eur: a.priceEur }} score={a.score} reason={a.reason}
                         meta={`${a.watchLabel} · ${describeWhen(a.createdAt, now)}`} />
          ))}
        </div>
      )}
    </section>
  );
}
