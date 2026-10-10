import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import Sheet from "../components/Sheet.jsx";
import { recentErrors } from "../lib/errors.js";
import { feedbackContext } from "../lib/screenshot.js";
import { track } from "../lib/track.js";
import { linkTo } from "../lib/router.js";

const WOULD_PAY = [
  ["no", "No, only if it's free"],
  ["maybe", "Maybe"],
  ["eur2", "Yes, about €2 a month"],
  ["eur5", "Yes, about €5 a month"],
  ["eur10", "Yes, €10 or more a month"],
];

/** "Give feedback": a suggestion box plus "Would you pay for this?", read by a real person. The page it was opened
 *  from comes along as a screenshot (taken just before the sheet opened, e-mail blanked out; untick to leave it out). */
export default function FeedbackSheet({ page, screenshot, onClose, toast }) {
  const submit = useMutation(api.feedback.submit);
  const uploadUrl = useMutation(api.feedback.generateUploadUrl);
  const [attach, setAttach] = useState(true);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!screenshot) return;
    const url = URL.createObjectURL(screenshot);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);
  const [message, setMessage] = useState("");
  const [wouldPay, setWouldPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = message.trim() || wouldPay;

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      let screenshotId;
      if (screenshot && attach) {
        try {
          const res = await fetch(await uploadUrl(), { method: "POST", headers: { "Content-Type": screenshot.type }, body: screenshot });
          if (res.ok) screenshotId = (await res.json()).storageId;
        } catch { /* the feedback matters more than the picture: send it without */ }
      }
      const errors = recentErrors();
      await submit({ message: message.trim() || undefined, wouldPay: wouldPay ?? undefined, page, screenshotId,
                     context: { ...feedbackContext(), errors: errors.length ? errors : undefined } });
      track("feedback_sent", { section: page, kind: screenshotId ? "screenshot" : "no screenshot" });
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
        {preview && (
          <label className="shot">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
            <img src={preview} alt="Screenshot of the page you were on" className={attach ? "" : "off"} />
            <span><strong>Attach a screenshot of this page</strong><br />
              <span className="muted">It helps Daryl see what you saw. Your e-mail is hidden. You can untick this.</span></span>
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary wide" disabled={!ready || busy}>{busy ? "Sending…" : "Send"}</button>
        <p className="small muted">Sent with your e-mail address, so Daryl can reply, plus the page, screen size and browser
          to help fix bugs.</p>
        <a {...linkTo("/whats-new")}>See what we built from your feedback</a>
      </form>
    </Sheet>
  );
}
