import { useState } from "react";

function ScoreBadge({ score }) {
  if (score === undefined || score === null) return null;
  const tone = score >= 8 ? "great" : score >= 6 ? "good" : "low";
  return <span className={`score ${tone}`} aria-label={`Scored ${score} out of 10`}>{score}<small>/10</small></span>;
}

/** One listing as a card: photo, title, price, place, and (for alerts) the score and its reason. */
export default function ListingCard({ listing, score, reason, meta }) {
  const [broken, setBroken] = useState(false);
  const price = listing.price_eur ?? listing.priceEur;
  const place = [listing.city ?? null, listing.distance_km != null ? `${listing.distance_km} km` : null].filter(Boolean).join(", ");
  return (
    <a className="listing" href={listing.url} target="_blank" rel="noopener noreferrer">
      <div className="photo">
        {listing.image && !broken
          ? <img src={listing.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : <span className="no-photo">No photo</span>}
        <ScoreBadge score={score} />
      </div>
      <div className="body">
        <span className="title">{listing.title}</span>
        <span className="line">
          <strong>{price ? `€${price}` : "Price on request"}</strong>
          {place && <span>{place}</span>}
        </span>
        {reason && <span className="reason">{reason}</span>}
        {meta && <span className="meta">{meta}</span>}
      </div>
    </a>
  );
}
