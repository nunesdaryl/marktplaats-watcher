import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { track } from "../lib/track.js";

export default function RatingNudge({ watchId }) {
  const nudge = useQuery(api.ratings.nudge, watchId ? { watchId } : {});
  const show = useMutation(api.ratings.markNudgeShown);
  const dismiss = useMutation(api.ratings.dismissNudge);
  const rate = useMutation(api.ratings.rate);
  const [thanks, setThanks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (nudge) show().catch(() => {}); }, [!!nudge, show]);
  if (!nudge) return thanks ? <p className="muted" role="status">Thanks — this watch will use it from the next check.</p> : null;
  const choose = async (verdict) => {
    setBusy(true); setError("");
    try {
      await rate({ alertId: nudge.alert._id, verdict });
      setThanks(true);
      track("alert_rated", { value: verdict });
    } catch { setError("That didn't save. Try again."); }
    finally { setBusy(false); }
  };
  return <aside className="rating-nudge" aria-label="Rate your first alerts">
    <button type="button" className="icon-button rating-nudge-close" aria-label="Dismiss rating reminder"
      onClick={() => dismiss()}>×</button>
    <strong>Rate your first 3 alerts — each rating tunes this watch for you.</strong>
    {thanks && <p className="muted" role="status">Thanks — this watch will use it from the next check.</p>}
    <p className="muted">{nudge.alert.title}</p>
    <div className="rating-nudge-actions">
      <button type="button" className="button" disabled={busy} onClick={() => choose("good")}>Good match</button>
      <button type="button" className="button" disabled={busy} onClick={() => choose("not_right")}>Not right</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </aside>;
}
