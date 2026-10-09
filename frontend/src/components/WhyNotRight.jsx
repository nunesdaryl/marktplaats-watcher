import { useState } from "react";
import { REASONS } from "../lib/ratings.js";
import RatingFix from "./RatingFix.jsx";

/** "Thanks, tell us why?" after "Not right": optional chips and a note. Sending is optional too. */
export default function WhyNotRight({ initial = { reasons: [], note: "" }, onSend, busy, alert, onFix, onUndo }) {
  const [reasons, setReasons] = useState(initial.reasons ?? []);
  const [note, setNote] = useState(initial.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const toggle = (key) => setReasons(reasons.includes(key) ? reasons.filter((r) => r !== key) : [...reasons, key]);
  return (
    <form className="why" onSubmit={async (e) => { e.preventDefault(); if (submitted) return;
      try { await onSend({ reasons, note }); setSubmitted(true); } catch { /* The parent shows the save error. */ } }}>
      <p className="why-title">Thanks, tell us why?</p>
      <div className="chips" role="group" aria-label="What was wrong">
        {REASONS.map(([key, label]) => (
          <button key={key} type="button" disabled={submitted} className={`chip ${reasons.includes(key) ? "selected" : ""}`} aria-pressed={reasons.includes(key)}
                  onClick={() => toggle(key)}>{label}</button>
        ))}
      </div>
      {submitted && <p className="muted">Thanks, that helps improve this watch's scores.</p>}
      {submitted && alert && <RatingFix reasons={reasons} alert={alert} onFix={onFix} onUndo={onUndo} />}
      {!submitted && <>
      <textarea className="field" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else? (optional)" aria-label="Anything else" />
      <button className="button primary" disabled={busy || (!reasons.length && !note.trim())}>{busy ? "Sending…" : "Send"}</button>
      </>}
    </form>
  );
}
