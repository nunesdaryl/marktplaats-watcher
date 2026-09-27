import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import ScheduleEditor from "./ScheduleEditor.jsx";

const HOURLY = { kind: "interval", everyMinutes: 60 };
const number = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

/** Create a watch (from a chat search or proposal) or edit one. A native <dialog>: focus-trapped, Esc closes. */
export default function WatchForm({ mode, initial, watchId, onClose }) {
  const create = useMutation(api.watches.create);
  const update = useMutation(api.watches.update);
  const dialog = useRef(null);
  const [f, setF] = useState(() => ({
    query: initial.query ?? "",
    mustInclude: initial.mustInclude ?? "",
    maxPriceEur: initial.maxPriceEur ?? "",
    postcode: initial.postcode ?? "",
    maxDistanceKm: initial.maxDistanceKm ?? "",
    schedule: initial.schedule ?? HOURLY,
    notify: initial.notify ?? "good",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key) => ({ value: f[key], onChange: (e) => setF({ ...f, [key]: e.target.value }) });

  useEffect(() => { dialog.current.showModal(); }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "create") {
        await create({
          query: f.query, mustInclude: f.mustInclude || undefined, maxPriceEur: number(f.maxPriceEur),
          postcode: f.postcode || undefined, maxDistanceKm: f.postcode ? number(f.maxDistanceKm) : undefined,
          schedule: f.schedule, notify: f.notify,
        });
      } else {
        await update({ id: watchId, schedule: f.schedule, notify: f.notify, maxPriceEur: number(f.maxPriceEur) ?? null });
      }
      onClose(true);
    } catch (err) {
      setError(err.data ?? "Saving didn't work. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="watch-form" onClose={() => onClose(false)} aria-labelledby="watch-form-title">
      <form onSubmit={save}>
        <h2 id="watch-form-title">{mode === "create" ? "Watch this search" : `Edit "${initial.label}"`}</h2>

        {mode === "create" ? (
          <fieldset className="search">
            <legend>What to look for</legend>
            <label>Item<input {...field("query")} required minLength={2} maxLength={80} placeholder="mac mini" /></label>
            <label>Title must include<input {...field("mustInclude")} maxLength={40} placeholder="16gb (optional)" /></label>
            <label>Max price in €<input {...field("maxPriceEur")} type="number" min="1" inputMode="numeric" placeholder="optional" /></label>
            <label>Near postcode<input {...field("postcode")} maxLength={7} placeholder="1012AB (optional)" /></label>
            {f.postcode && <label>Within km<input {...field("maxDistanceKm")} type="number" min="1" max="300" required /></label>}
          </fieldset>
        ) : (
          <label className="solo">Max price in €
            <input {...field("maxPriceEur")} type="number" min="1" inputMode="numeric" placeholder="no limit" />
          </label>
        )}

        <ScheduleEditor schedule={f.schedule} notify={f.notify} onChange={(s) => setF({ ...f, ...s })} />

        {mode === "create" && (
          <p className="hint">The first check only notes what's already listed, so you're only e-mailed about new ones.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="actions">
          <button type="button" className="ghost" onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" className="primary"
                  disabled={busy || (f.schedule.kind === "weekly" && !f.schedule.days.length)}>
            {busy ? "Saving…" : mode === "create" ? "Save watch" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
