import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { NOTIFY_LABEL, NOTIFY_SHORT, describe } from "../../convex/schedule";
import { scheduleKind, track } from "../lib/track.js";
import BroadWatchWarning, { broadWatchMessage } from "./BroadWatchWarning.jsx";

const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
export const watchFields = (p) => defined({ query: p.query, mustInclude: p.mustInclude, maxPriceEur: p.maxPriceEur,
  postcode: p.postcode, maxDistanceKm: p.maxDistanceKm, includeBusinessSellers: p.includeBusinessSellers });

function searchText(p) {
  return [p.query, p.mustInclude, p.maxPriceEur && `under €${p.maxPriceEur}`,
    p.postcode && p.maxDistanceKm && `within ${p.maxDistanceKm} km of ${p.postcode}`].filter(Boolean).join(", ");
}

function changeText(p) {
  return [p.schedule && `check it ${describe(p.schedule)}`, p.notify && `e-mail you ${NOTIFY_LABEL[p.notify]} (${NOTIFY_SHORT[p.notify]})`,
    p.maxPriceEur && `set the max price to €${p.maxPriceEur}`, p.active === false && "pause it",
    p.active === true && "resume it", p.includeBusinessSellers === true && "also show shops and dealers",
    p.includeBusinessSellers === false && "hide shops and dealers"].filter(Boolean).join(", ");
}

/** A watch the chat suggested. Nothing is saved until you press the button. */
export default function Proposal({ p, saved, onSaved, onAdjust }) {
  const create = useMutation(api.watches.create);
  const update = useMutation(api.watches.update);
  const [state, setState] = useState(saved ? "saved" : "open");
  const [error, setError] = useState("");
  const [notify, setNotify] = useState(p.notify);
  const broadMessage = p.type === "create" ? broadWatchMessage(p.volumeNote, p.maxPriceEur, notify) : null;
  if (state === "dismissed") return null;

  async function save() {
    setState("saving");
    setError("");
    try {
      if (p.type === "create") await create({ ...watchFields(p), schedule: p.schedule, notify });
      else await update(defined({ id: p.watchId, schedule: p.schedule, notify: p.notify, active: p.active, maxPriceEur: p.maxPriceEur,
        includeBusinessSellers: p.includeBusinessSellers }));
      setState("saved");
      if (p.type === "create") track("watch_saved", { kind: scheduleKind(p.schedule), value: notify, mode: "from chat" });
      onSaved?.();
    } catch (e) {
      setError(e.data ?? "Saving didn't work. Try again.");
      setState("open");
    }
  }

  return (
    <div className="proposal">
      {p.type === "create" ? (
        <p>Watch <strong>{searchText(p)}</strong>, checked <strong>{describe(p.schedule)}</strong>, and e-mail you {NOTIFY_LABEL[notify]} ({NOTIFY_SHORT[notify]}). {p.includeBusinessSellers ? "Also show shops and dealers." : "Hide shops and dealers."}</p>
      ) : (
        <p>For <strong>{p.label}</strong>: {changeText(p)}.</p>
      )}
      {state !== "saved" && p.type === "create" && <BroadWatchWarning
        message={broadMessage}
        onPrice={() => onAdjust({ ...watchFields(p), schedule: p.schedule, notify, volumeNote: p.volumeNote, focusMaxPrice: true })}
        onGood={() => setNotify("good")} showGood={notify !== "good"} />}
      {p.volumeNote && state !== "saved" && <p className="hint" role="status">{p.volumeNote}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {state === "saved" ? (
        <p className="done">{p.type === "create" ? "Watch saved. The first check only notes what's listed now; after that, new ones that fit are e-mailed with the reason." : "Change saved."}</p>
      ) : (
        <div className="actions">
          <button className="button primary" onClick={save} disabled={state === "saving"}>
            {p.type === "create" ? "Save watch" : "Save change"}
          </button>
          {p.type === "create"
            ? <button className="button" onClick={() => onAdjust({ ...watchFields(p), schedule: p.schedule, notify,
              volumeNote: p.volumeNote })}>Adjust</button>
            : <button className="button" onClick={() => setState("dismissed")}>Dismiss</button>}
        </div>
      )}
    </div>
  );
}
