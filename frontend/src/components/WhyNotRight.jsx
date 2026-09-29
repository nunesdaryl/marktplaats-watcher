import { useState } from "react";
import { REASONS } from "../lib/ratings.js";

/** "Thanks, tell us why?" after a 👎: optional chips and a note. Sending is optional too. */
export default function WhyNotRight({ initial = { reasons: [], note: "" }, onSend, busy }) {
  const [reasons, setReasons] = useState(initial.reasons ?? []);
  const [note, setNote] = useState(initial.note ?? "");
  const toggle = (key) => setReasons(reasons.includes(key) ? reasons.filter((r) => r !== key) : [...reasons, key]);
  return (
    <form className="why" onSubmit={(e) => { e.preventDefault(); onSend({ reasons, note }); }}>
      <p className="why-title">Thanks, tell us why?</p>
      <div className="chips" role="group" aria-label="What was wrong">
        {REASONS.map(([key, label]) => (
          <button key={key} type="button" className={`chip ${reasons.includes(key) ? "selected" : ""}`} aria-pressed={reasons.includes(key)}
                  onClick={() => toggle(key)}>{label}</button>
        ))}
      </div>
      <textarea className="field" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything else? (optional)" aria-label="Anything else" />
      <button className="button primary" disabled={busy || (!reasons.length && !note.trim())}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}
