import ThemeToggle from "./ThemeToggle.jsx";

/** The slim strip at the top of every signed-in page: feedback is always one tap away, wherever something goes wrong.
 *  On desktop it also holds the sun/moon toggle (top right); on phones that sits in the top bar. */
export default function BetaBanner({ onFeedback, busy, withToggle }) {
  return (
    <div className="beta-strip">
      <button className="beta-banner" onClick={onFeedback} disabled={busy} aria-busy={busy || undefined}>
        <span className="beta-tag">Free beta</span>
        <span className="beta-text">{busy ? "Opening feedback…" : "Give feedback & suggestions"}</span>
        <span aria-hidden="true" className="beta-arrow">→</span>
      </button>
      {withToggle && <ThemeToggle className="icon-button small" />}
    </div>
  );
}
