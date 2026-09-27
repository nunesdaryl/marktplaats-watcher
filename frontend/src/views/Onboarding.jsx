import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { NOTIFY_LABEL, describe } from "../../convex/schedule";
import ScheduleEditor from "../components/ScheduleEditor.jsx";
import Sheet from "../components/Sheet.jsx";

const IDEAS = ["Mac mini", "Gazelle bike", "Nintendo Switch OLED", "IKEA Pello chair"];

/** First run: three short steps that end with a real watch. Can be skipped at any point. */
export default function Onboarding({ email, onDone }) {
  const create = useMutation(api.watches.create);
  const finish = useMutation(api.users.finishOnboarding);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [plan, setPlan] = useState({ schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function close(watchId) {
    await finish().catch(() => {});
    onDone(watchId);
  }

  async function startWatching() {
    setBusy(true);
    setError("");
    try {
      const id = await create({ query, maxPriceEur: maxPrice ? Number(maxPrice) : undefined, ...plan });
      await close(id);
    } catch (e) {
      setError(e.data ?? "That didn't work. Try again.");
      setBusy(false);
    }
  }

  const steps = [
    <div key="what" className="stack">
      <p className="lead">What should we keep an eye on?</p>
      <input className="field big" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus maxLength={80}
             placeholder="e.g. Mac mini" aria-label="Item to watch" />
      <div className="suggestions left">{IDEAS.map((i) => <button key={i} type="button" className="chip" onClick={() => setQuery(i)}>{i}</button>)}</div>
      <input className="field" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" min="1"
             inputMode="numeric" placeholder="Max price in € (optional)" aria-label="Max price in euros" />
    </div>,
    <div key="when" className="stack">
      <p className="lead">When should we check, and what should we send you?</p>
      <ScheduleEditor schedule={plan.schedule} notify={plan.notify} onChange={setPlan} />
    </div>,
    <div key="where" className="stack">
      <p className="lead">Alerts go to <strong>{email}</strong>, from marktplaats-watcher@agentmail.to.</p>
      <p className="sentence small">Checking Marktplaats for <mark>{query}{maxPrice ? ` under €${maxPrice}` : ""}</mark>{" "}
        <mark>{describe(plan.schedule)}</mark>, e-mailing you <mark>{NOTIFY_LABEL[plan.notify]}</mark>.</p>
      <p className="hint">The first check only notes what's listed now, so you only hear about new ones.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </div>,
  ];

  const canNext = step !== 0 || query.trim().length >= 2;
  return (
    <Sheet title={`Set up your first watch · ${step + 1} of 3`} onClose={() => close(null)}
           footer={<>
             <button className="button plain" onClick={() => (step ? setStep(step - 1) : close(null))}>{step ? "Back" : "Skip"}</button>
             {step < 2
               ? <button className="button primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>
               : <button className="button primary" disabled={busy} onClick={startWatching}>{busy ? "Saving…" : "Start watching"}</button>}
           </>}>
      <div className="progress" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
      {steps[step]}
    </Sheet>
  );
}
