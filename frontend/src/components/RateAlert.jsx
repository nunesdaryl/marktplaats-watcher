import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { REASONS } from "../lib/ratings.js";
import { track } from "../lib/track.js";
import WhyNotRight from "./WhyNotRight.jsx";

const LABEL = Object.fromEntries(REASONS);

/** Under an alert: "Good match?" 👍 → Thanks. 👎 → Thanks, tell us why? The answer can be changed any time. */
export default function RateAlert({ alertId, rating }) {
  const rate = useMutation(api.ratings.rate);
  const explain = useMutation(api.ratings.explain);
  const [asking, setAsking] = useState(false);
  const [thanks, setThanks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = (op) => { setBusy(true); setError(""); return op.catch((e) => setError(e.data ?? "That didn't save. Try again.")).finally(() => setBusy(false)); };

  const choose = (verdict) => run(rate({ alertId, verdict }).then(() => {
    track("alert_rated", { value: verdict });
    setThanks("Thanks!");
    setAsking(verdict === "not_right");
  }));

  if (asking) {
    return (
      <div className="rate">
        <WhyNotRight initial={rating?.verdict === "not_right" ? rating : undefined} busy={busy}
                     onSend={(why) => run(explain({ alertId, ...why }).then(() => { setAsking(false); setThanks("Thanks, that helps us improve the scores."); }))} />
        <button className="link-button small" onClick={() => setAsking(false)}>Skip</button>
        {error && <p className="error small">{error}</p>}
      </div>
    );
  }
  if (rating) {
    const why = rating.verdict === "not_right" && [...rating.reasons.map((r) => LABEL[r] ?? r), rating.note].filter(Boolean).join(" · ");
    return (
      <div className="rate done">
        <span>{thanks || "You said:"} <strong>{rating.verdict === "good" ? "👍 Good match" : "👎 Not right"}</strong>{why ? ` (${why})` : ""}</span>
        <button className="link-button small" onClick={() => (rating.verdict === "good" ? choose("not_right") : setAsking(true))}>
          {rating.verdict === "good" ? "Not right after all?" : "Tell us why"}
        </button>
        {rating.verdict === "not_right" && <button className="link-button small" onClick={() => choose("good")}>It's good after all</button>}
        {error && <p className="error small">{error}</p>}
      </div>
    );
  }
  return (
    <div className="rate">
      <span className="rate-q">Good match?</span>
      <button className="button small-button rate-yes" disabled={busy} onClick={() => choose("good")}>👍 Yes</button>
      <button className="button small-button rate-no" disabled={busy} onClick={() => choose("not_right")}>👎 Not right</button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
