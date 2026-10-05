import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import AccountButton from "./AccountButton.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const feelings = [
  ["very", "Very disappointed"], ["somewhat", "Somewhat disappointed"],
  ["not", "Not disappointed"], ["unused", "I no longer use it"],
];
const prices = [
  ["no", "No"], ["up_to_5", "Yes, up to €5 a month"],
  ["5_to_10", "€5–10"], ["over_10", "more than €10"],
];

export default function FoundingPrompt({ state, onClose, keepOpen = false }) {
  const answerSurvey = useMutation(api.founding.answerSurvey);
  const extend = useMutation(api.founding.extend);
  const dismiss = useMutation(api.founding.dismiss);
  const [feeling, setFeeling] = useState(state.disappointed ?? "");
  const [benefit, setBenefit] = useState(state.benefit ?? "");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ended = state.ended || keepOpen;
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (ended) await extend({ disappointed: feeling, wouldPay: price });
      else await answerSurvey({ disappointed: feeling, benefit });
      onClose?.();
    } catch (e) { setError(e?.message ?? "Please try again."); }
    finally { setBusy(false); }
  };
  return <div className={state.ended ? "waitlist-page" : "founding-card-wrap"}>
    {state.ended && <header className="waitlist-bar"><Logo size={40} /><span className="name wordmark">Marktplaats <b>Watcher</b></span><ThemeToggle /><AccountButton /></header>}
    <main className={state.ended ? "waitlist-card" : "founding-card"}>
      <p className="waitlist-eyebrow">Founding user</p>
      <h1>{ended ? "Keep my watches" : "One quick question"}</h1>
      <p>{state.ended ? "Your free month has ended. Your watches are paused. Answer two questions to continue free for another 30 days." : ended ? "Answer two questions to keep your watches for another 30 days free." : "Help us make Marktplaats Watcher useful."}</p>
      <form onSubmit={submit} className="stack">
        <fieldset><legend>How would you feel if you could no longer use Marktplaats Watcher?</legend>
          {feelings.map(([value, label]) => <label key={value} className="founding-choice"><input type="radio" name="feeling" value={value} checked={feeling === value} onChange={() => setFeeling(value)} required /> {label}</label>)}
        </fieldset>
        {ended ? <fieldset><legend>Would you pay for this?</legend>
          {prices.map(([value, label]) => <label key={value} className="founding-choice"><input type="radio" name="price" value={value} checked={price === value} onChange={() => setPrice(value)} required /> {label}</label>)}
        </fieldset> : <label>What is the main benefit for you? <span className="muted">Optional</span>
          <textarea className="field" maxLength={300} value={benefit} onChange={(e) => setBenefit(e.target.value)} /></label>}
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy || !feeling || ended && !price}>{busy ? "Saving…" : ended ? "Keep my watches" : "Send answer"}</button>
      </form>
      {!state.ended && <button className="link-button" onClick={async () => { if (!ended) await dismiss(); onClose?.(); }}>Not now</button>}
    </main>
  </div>;
}
