import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import Sheet from "../components/Sheet.jsx";

const WOULD_PAY = [
  ["no", "No, only if it's free"],
  ["maybe", "Maybe"],
  ["eur2", "Yes, about €2 a month"],
  ["eur5", "Yes, about €5 a month"],
  ["eur10", "Yes, €10 or more a month"],
];

/** "Give feedback": a suggestion box plus "Would you pay for this?", read by a real person. */
export default function FeedbackSheet({ page, onClose, toast }) {
  const submit = useMutation(api.feedback.submit);
  const [message, setMessage] = useState("");
  const [wouldPay, setWouldPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = message.trim() || wouldPay;

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await submit({ message: message.trim() || undefined, wouldPay: wouldPay ?? undefined, page });
      toast("Thank you. Daryl reads every message.");
      onClose();
    } catch (err) {
      setError(err.data ?? "That didn't send. Try again.");
      setBusy(false);
    }
  };

  return (
    <Sheet title="Feedback and suggestions" onClose={onClose}>
      <form className="stack" onSubmit={send}>
        <p className="muted">Marktplaats Watcher is a free beta. What's missing, confusing or great? Every message is read.</p>
        <textarea className="field" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="An idea, a bug, a search it got wrong…" aria-label="Your feedback or suggestion" />
        <fieldset className="choices">
          <legend>Would you pay for this?</legend>
          {WOULD_PAY.map(([value, label]) => (
            <button key={value} type="button" className={`chip ${wouldPay === value ? "selected" : ""}`} aria-pressed={wouldPay === value}
                    onClick={() => setWouldPay(wouldPay === value ? null : value)}>{label}</button>
          ))}
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary wide" disabled={!ready || busy}>{busy ? "Sending…" : "Send"}</button>
        <p className="small muted">Sent with your e-mail address, so Daryl can reply.</p>
      </form>
    </Sheet>
  );
}
