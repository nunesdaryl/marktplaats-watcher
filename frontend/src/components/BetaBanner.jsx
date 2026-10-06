import AccountButton from "./AccountButton.jsx";
import { ACCOUNT_TOP_RIGHT } from "../lib/flags.js";
import ThemeToggle from "./ThemeToggle.jsx";

/** The slim strip at the top of every signed-in page: feedback is always one tap away, wherever something goes wrong.
 *  On desktop it also holds the sun/moon toggle (top right); on phones that sits in the top bar. */
export default function BetaBanner({ onFeedback, onPrivacy, busy, withToggle, freeUntil, budget, onKeep }) {
  const date = freeUntil && new Date(freeUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
  const keepVisible = freeUntil && Date.now() >= freeUntil - 5 * 86_400_000;
  return (
    <div className="beta-strip">
      <button className="beta-banner" onClick={onFeedback} disabled={busy} aria-busy={busy || undefined}>
        <span className="beta-tag">{date ? `Founding user · free until ${date}` : "Free beta"}</span>
        <span className="beta-text">{busy ? "Opening feedback…" : "Give feedback & suggestions"}</span>
        <span aria-hidden="true" className="beta-arrow">→</span>
      </button>
      {keepVisible && onKeep && <button className="link-button beta-keep" onClick={onKeep}>· Keep my watches</button>}
      {budget && !budget.owner && <span className="beta-spend">€{budget.spentEur.toFixed(2)} of €{budget.limitEur.toFixed(2)} used</span>}
      {withToggle && <ThemeToggle className="icon-button small" />}
      {withToggle && ACCOUNT_TOP_RIGHT && <div className="beta-account" role="group" aria-label="Account"><AccountButton onPrivacy={onPrivacy} /></div>}
    </div>
  );
}
