import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { REASONS } from "../lib/ratings.js";
import { track } from "../lib/track.js";
import WhyNotRight from "./WhyNotRight.jsx";
import Icon from "./Icon.jsx";

const LABEL = Object.fromEntries(REASONS);

/** Under an alert: "Good match?" Yes → Thanks. Not right → Thanks, tell us why? The answer can be changed any time. */
export default function RateAlert({ alertId, rating, alert, onArchive }) {
  const rate = useMutation(api.ratings.rate);
  const explain = useMutation(api.ratings.explain);
  const fix = useMutation(api.ratings.fix);
  const undo = useMutation(api.ratings.undo);
  const [asking, setAsking] = useState(false);
  const [thanks, setThanks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = (op) => { setBusy(true); setError(""); return op.catch((e) => setError(e.data ?? "That didn't save. Try again.")).finally(() => setBusy(false)); };

  const choose = (verdict) => run(rate({ alertId, verdict }).then(() => {
    track("alert_rated", { value: verdict });
    setThanks("Thanks — this watch will use it from the next check.");
    setAsking(verdict === "not_right");
  }));
  const archive = <button type="button" className="icon-button small rate-archive" aria-label="Archive alert" title="Archive alert"
                          onClick={onArchive}><Icon name="archive" size={18} /></button>;

  if (asking) {
    return (
      <div className="rate">
        {thanks && <p className="rate-thanks">{thanks}</p>}
        <WhyNotRight initial={rating?.verdict === "not_right" ? rating : undefined} busy={busy}
          alert={alert} onFix={(args) => fix({ alertId, ...args })} onUndo={() => undo({ alertId })}
          onSend={async (why) => { setBusy(true); setError(""); try { await explain({ alertId, ...why }); setThanks("Thanks — this watch will use it from the next check."); }
            catch (e) { setError(e.data ?? "That didn't save. Try again."); throw e; } finally { setBusy(false); } }} />
        <button className="link-button small" onClick={() => setAsking(false)}>Skip</button>
        {error && <p className="error small">{error}</p>}
        {archive}
      </div>
    );
  }
  if (rating) {
    const why = rating.verdict === "not_right" && [...rating.reasons.map((r) => LABEL[r] ?? r), rating.note].filter(Boolean).join(" · ");
    return (
      <div className="rate done">
        <span>{thanks || "You said:"} <strong>{rating.verdict === "good" ? "Good match" : "Not right"}</strong>{why ? ` (${why})` : ""}</span>
        <button className="link-button small" onClick={() => (rating.verdict === "good" ? choose("not_right") : setAsking(true))}>
          {rating.verdict === "good" ? "Not right after all?" : "Tell us why"}
        </button>
        {rating.verdict === "not_right" && <button className="link-button small" onClick={() => choose("good")}>It's good after all</button>}
        {error && <p className="error small">{error}</p>}
        {archive}
      </div>
    );
  }
  return (
    <div className="rate">
      <span className="rate-q">Good match?</span>
      <button className="button small-button rate-yes" disabled={busy} onClick={() => choose("good")}>Yes</button>
      <button className="button small-button rate-no" disabled={busy} onClick={() => choose("not_right")}>Not right</button>
      {error && <p className="error small">{error}</p>}
      {archive}
    </div>
  );
}
