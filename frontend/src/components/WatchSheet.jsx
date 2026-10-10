import { useAuth } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import ScheduleEditor from "./ScheduleEditor.jsx";
import Sheet from "./Sheet.jsx";
import WatchLifecycle from "./WatchLifecycle.jsx";
import BroadWatchWarning, { broadWatchMessage } from "./BroadWatchWarning.jsx";
import { scheduleKind, track } from "../lib/track.js";

const HOURLY = { kind: "interval", everyMinutes: 60 };
const number = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

/** Create a watch (from a search, a chat proposal or from scratch) or edit one. */
export default function WatchSheet({ mode, initial = {}, watchId, onClose }) {
  const { getToken } = useAuth();
  const create = useMutation(api.watches.create);
  const update = useMutation(api.watches.update);
  const [f, setF] = useState(() => ({
    query: initial.query ?? "", mustInclude: initial.mustInclude ?? "", maxPriceEur: initial.maxPriceEur ?? "",
    excludeWords: initial.excludeWords ?? [],
    postcode: initial.postcode ?? "", maxDistanceKm: initial.maxDistanceKm ?? "",
    schedule: initial.schedule ?? HOURLY, notify: initial.notify ?? "good",
    includeBusinessSellers: initial.includeBusinessSellers ?? false,
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [volumeNote, setVolumeNote] = useState(initial.volumeNote ?? null);
  const [estimateDelay, setEstimateDelay] = useState(null);
  const hasChanged = useRef(false);
  const priceInput = useRef(null);
  const field = (key) => ({ value: f[key], onChange: (e) => {
    hasChanged.current = true; setF({ ...f, [key]: e.target.value }); setVolumeNote(null); setEstimateDelay(800);
  }, onBlur: () => { if (hasChanged.current) setEstimateDelay(0); } });
  const weeklyWithoutDays = f.schedule.kind === "weekly" && !f.schedule.days.length;
  const broadMessage = broadWatchMessage(volumeNote, f.maxPriceEur, f.notify);

  useEffect(() => { if (initial.focusMaxPrice) priceInput.current?.focus(); }, []);

  useEffect(() => {
    if (estimateDelay === null) return;
    if (f.query.trim().length < 2 || weeklyWithoutDays) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      hasChanged.current = false;
      try {
        const response = await fetch("/api/watch/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
          body: JSON.stringify({ query: f.query, mustInclude: f.mustInclude || null,
            maxPriceEur: number(f.maxPriceEur), postcode: f.postcode || null,
            maxDistanceKm: f.postcode ? number(f.maxDistanceKm) : null, schedule: f.schedule }),
          signal: controller.signal,
        });
        if (response.ok) {
          const result = await response.json();
          if (!controller.signal.aborted) setVolumeNote(result.volumeNote);
        } else if (!controller.signal.aborted) setVolumeNote(null);
      } catch { /* The estimate is advisory; saving still works if the search is unavailable. */ }
    }, estimateDelay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [f.query, f.mustInclude, f.maxPriceEur, f.postcode, f.maxDistanceKm, f.schedule, estimateDelay]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let id = watchId;
      if (mode === "create") {
        id = await create({
          query: f.query, mustInclude: f.mustInclude || undefined, maxPriceEur: number(f.maxPriceEur),
          excludeWords: f.excludeWords,
          postcode: f.postcode || undefined, maxDistanceKm: f.postcode ? number(f.maxDistanceKm) : undefined,
          schedule: f.schedule, notify: f.notify, includeBusinessSellers: f.includeBusinessSellers,
        });
      } else {
        await update({
          id: watchId, schedule: f.schedule, notify: f.notify, query: f.query,
          includeBusinessSellers: f.includeBusinessSellers,
          mustInclude: f.mustInclude.trim() || null, maxPriceEur: number(f.maxPriceEur) ?? null,
          excludeWords: f.excludeWords,
          postcode: f.postcode.trim() || null, maxDistanceKm: f.postcode.trim() ? number(f.maxDistanceKm) ?? null : null,
        });
      }
      track("watch_saved", { kind: scheduleKind(f.schedule), value: f.notify, mode: mode === "create" ? "new" : "edit" });
      onClose(id);
    } catch (err) {
      setError(err.data ?? "Saving didn't work. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={mode === "create" ? "New watch" : "Edit watch"} onClose={() => onClose(null)}>
      <form className="stack" onSubmit={save} id="watch-sheet">
        {(
          <div className="group">
            <label className="row"><span>Item</span>
              <input {...field("query")} required minLength={2} maxLength={80} placeholder="Mac mini" autoFocus /></label>
            <label className="row"><span>Title includes</span>
              <input {...field("mustInclude")} maxLength={40} placeholder="Optional, e.g. 16gb" /></label>
            {f.excludeWords.length > 0 && <div className="row"><span>Skipping: {f.excludeWords.join(", ")}</span>
              <div className="chips">{f.excludeWords.map((word) => <button key={word} type="button" className="chip"
                aria-label={`Remove ${word} from skipped words`}
                onClick={() => setF({ ...f, excludeWords: f.excludeWords.filter((value) => value !== word) })}>Remove {word} ×</button>)}</div></div>}
            <label className="row"><span>Max price</span>
              <input {...field("maxPriceEur")} ref={priceInput} type="number" min="1" inputMode="numeric" placeholder="Optional, in €" /></label>
            <label className="row"><span>Near postcode</span>
              <input {...field("postcode")} maxLength={7} placeholder="Optional, e.g. 1012AB" /></label>
            {f.postcode && <label className="row"><span>Within</span>
              <input {...field("maxDistanceKm")} type="number" min="1" max="300" required placeholder="km" /></label>}
          </div>
        )}
        {mode === "edit" && <p className="hint">Changing the item or place starts a fresh first look, so you're only told about listings that are new from then on.</p>}
        <label className="row"><span>Also show shops and dealers</span>
          <input type="checkbox" checked={f.includeBusinessSellers}
            onChange={(e) => setF({ ...f, includeBusinessSellers: e.target.checked })} /></label>
        <ScheduleEditor schedule={f.schedule} notify={f.notify} onChange={(s) => {
          setF({ ...f, ...s });
          if (s.schedule !== f.schedule) { hasChanged.current = true; setVolumeNote(null); setEstimateDelay(800); }
        }} />
        {volumeNote && <p className="hint" role="status">{volumeNote}</p>}
        <BroadWatchWarning message={broadMessage}
          onPrice={() => priceInput.current?.focus()} onGood={() => setF({ ...f, notify: "good" })}
          showGood={f.notify !== "good"} />
        {mode === "create" && <WatchLifecycle schedule={f.schedule} notify={f.notify} />}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button primary wide" disabled={busy || weeklyWithoutDays}>
          {busy ? "Saving…" : mode === "create" ? "Save watch" : "Save changes"}
        </button>
      </form>
    </Sheet>
  );
}
