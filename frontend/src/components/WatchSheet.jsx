import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import ScheduleEditor from "./ScheduleEditor.jsx";
import Sheet from "./Sheet.jsx";

const HOURLY = { kind: "interval", everyMinutes: 60 };
const number = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

/** Create a watch (from a search, a chat proposal or from scratch) or edit one. */
export default function WatchSheet({ mode, initial = {}, watchId, onClose }) {
  const create = useMutation(api.watches.create);
  const update = useMutation(api.watches.update);
  const [f, setF] = useState(() => ({
    query: initial.query ?? "", mustInclude: initial.mustInclude ?? "", maxPriceEur: initial.maxPriceEur ?? "",
    postcode: initial.postcode ?? "", maxDistanceKm: initial.maxDistanceKm ?? "",
    schedule: initial.schedule ?? HOURLY, notify: initial.notify ?? "good",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key) => ({ value: f[key], onChange: (e) => setF({ ...f, [key]: e.target.value }) });
  const weeklyWithoutDays = f.schedule.kind === "weekly" && !f.schedule.days.length;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let id = watchId;
      if (mode === "create") {
        id = await create({
          query: f.query, mustInclude: f.mustInclude || undefined, maxPriceEur: number(f.maxPriceEur),
          postcode: f.postcode || undefined, maxDistanceKm: f.postcode ? number(f.maxDistanceKm) : undefined,
          schedule: f.schedule, notify: f.notify,
        });
      } else {
        await update({ id: watchId, schedule: f.schedule, notify: f.notify, maxPriceEur: number(f.maxPriceEur) ?? null });
      }
      onClose(id);
    } catch (err) {
      setError(err.data ?? "Saving didn't work. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={mode === "create" ? "New watch" : "Edit watch"} onClose={() => onClose(null)}>
      <form className="stack" onSubmit={save} id="watch-sheet">
        {mode === "create" ? (
          <div className="group">
            <label className="row"><span>Item</span>
              <input {...field("query")} required minLength={2} maxLength={80} placeholder="Mac mini" autoFocus /></label>
            <label className="row"><span>Title includes</span>
              <input {...field("mustInclude")} maxLength={40} placeholder="Optional, e.g. 16gb" /></label>
            <label className="row"><span>Max price</span>
              <input {...field("maxPriceEur")} type="number" min="1" inputMode="numeric" placeholder="Optional, in €" /></label>
            <label className="row"><span>Near postcode</span>
              <input {...field("postcode")} maxLength={7} placeholder="Optional, e.g. 1012AB" /></label>
            {f.postcode && <label className="row"><span>Within</span>
              <input {...field("maxDistanceKm")} type="number" min="1" max="300" required placeholder="km" /></label>}
          </div>
        ) : (
          <div className="group">
            <div className="row static"><span>Item</span><span>{initial.label}</span></div>
            <label className="row"><span>Max price</span>
              <input {...field("maxPriceEur")} type="number" min="1" inputMode="numeric" placeholder="No limit" /></label>
          </div>
        )}
        <ScheduleEditor schedule={f.schedule} notify={f.notify} onChange={(s) => setF({ ...f, ...s })} />
        {mode === "create" && <p className="hint">The first check only notes what's listed now, so you only hear about new ones.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button primary wide" disabled={busy || weeklyWithoutDays}>
          {busy ? "Saving…" : mode === "create" ? "Save watch" : "Save changes"}
        </button>
      </form>
    </Sheet>
  );
}
