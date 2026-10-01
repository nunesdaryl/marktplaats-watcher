import { useState } from "react";
import Icon from "./Icon.jsx";
import { track } from "../lib/track.js";

function ScoreBadge({ score }) {
  if (score === undefined || score === null) return null;
  const tone = score >= 8 ? "great" : score >= 6 ? "good" : "low";
  return <span className={`score ${tone}`} aria-label={`Scored ${score} out of 10`}>{score}<small>/10</small></span>;
}

/** One listing as a card: photo, title, price, place, and (for alerts) the score and its reason. */
export default function ListingCard({ listing, score, reason, meta, isNew = false }) {
  const [broken, setBroken] = useState(false);
  const price = listing.price_eur ?? listing.priceEur;
  const city = listing.city;
  const distance = listing.distance_km != null ? `${listing.distance_km} km` : null;
  return (
    <a className={`listing ${score === 0 ? "skipped" : ""}`} href={listing.url} target="_blank" rel="noopener noreferrer"
       onClick={() => track(reason ? "alert_opened" : "listing_opened", { value: score ?? undefined })}>
      <div className="photo">
        {listing.image && !broken
          ? <img src={listing.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : <span className="no-photo"><Icon name="camera" size={24} /><span className="visually-hidden">No photo</span></span>}
        <ScoreBadge score={score} />
      </div>
      <div className="body">
        {isNew && <span className="alert-new-pill" aria-hidden="true">New</span>}
        <span className="title">{listing.title}</span>
        <span className="line">
          <strong className={price ? "price-number" : undefined}>{price ? `€${price}` : "No price listed"}</strong>
          {(city || distance) && <span> · {city}{city && distance ? ", " : ""}{distance && <span className="distance">{distance}</span>}</span>}
        </span>
        {reason && <span className="reason">{reason}</span>}
        {score === 0 && <span className="meta">Skipped</span>}
        {meta && <span className="meta">{meta}</span>}
      </div>
      {isNew && <span className="visually-hidden">, new</span>}
    </a>
  );
}
