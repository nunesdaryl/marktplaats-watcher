import { DAYS, NOTIFY_HELP, NOTIFY_LABEL, describe } from "../../convex/schedule";

// "Check Marktplaats [every hour ▾]" / "[every day at…] 08:00 + add a time" / "[on certain days at…] Mon Fri 18:00"
const PRESETS = [
  ["i15", "every 15 minutes"], ["i30", "every 30 minutes"], ["i60", "every hour"], ["i180", "every 3 hours"],
  ["i360", "every 6 hours"], ["i720", "every 12 hours"], ["daily", "every day at…"], ["weekly", "on certain days at…"],
];
const DAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function presetOf(s) {
  return s.kind === "interval" ? `i${s.everyMinutes}` : s.kind;
}

function fromPreset(value, current) {
  if (value.startsWith("i")) return { kind: "interval", everyMinutes: Number(value.slice(1)) };
  const times = current.kind === "daily" ? current.times : current.kind === "weekly" ? [current.time] : ["08:00"];
  if (value === "daily") return { kind: "daily", times };
  return { kind: "weekly", days: current.kind === "weekly" ? current.days : ["sat"], time: times[0] };
}

export default function ScheduleEditor({ schedule, notify, onChange }) {
  const set = (s) => onChange({ schedule: s, notify });
  const times = schedule.kind === "daily" ? schedule.times : schedule.kind === "weekly" ? [schedule.time] : [];
  const setTime = (i, t) => {
    if (schedule.kind === "daily") set({ ...schedule, times: schedule.times.map((x, j) => (j === i ? t : x)) });
    else set({ ...schedule, time: t });
  };

  return (
    <fieldset className="schedule">
      <legend className="visually-hidden">When to check</legend>
      <div className="sentence-row">
        <label htmlFor="preset">Check Marktplaats</label>
        <select id="preset" value={presetOf(schedule)} onChange={(e) => set(fromPreset(e.target.value, schedule))}>
          {PRESETS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </div>

      {schedule.kind === "weekly" && (
        <div className="days" role="group" aria-label="Days">
          {DAYS.map((d) => {
            const on = schedule.days.includes(d);
            return (
              <button type="button" key={d} aria-pressed={on}
                      onClick={() => set({ ...schedule, days: on ? schedule.days.filter((x) => x !== d) : [...schedule.days, d] })}>
                {DAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      )}

      {times.length > 0 && (
        <div className="times">
          {times.map((t, i) => (
            <span key={i} className="time">
              <input type="time" step="900" value={t} aria-label={`Time ${i + 1}`} required
                     onChange={(e) => setTime(i, e.target.value)} />
              {schedule.kind === "daily" && times.length > 1 && (
                <button type="button" className="link" aria-label={`Remove ${t}`}
                        onClick={() => set({ ...schedule, times: schedule.times.filter((_, j) => j !== i) })}>Remove</button>
              )}
            </span>
          ))}
          {schedule.kind === "daily" && times.length < 4 && (
            <button type="button" className="link" onClick={() => set({ ...schedule, times: [...schedule.times, "18:00"] })}>
              Add a time
            </button>
          )}
        </div>
      )}

      <div className="sentence-row">
        <label htmlFor="notify">and e-mail me</label>
        <select id="notify" value={notify} onChange={(e) => onChange({ schedule, notify: e.target.value })}>
          {Object.entries(NOTIFY_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </div>
      <p className="notify-help" aria-live="polite">{NOTIFY_HELP[notify]}</p>

      <p className="summary">
        {schedule.kind === "weekly" && schedule.days.length === 0
          ? "Pick at least one day."
          : <>Checked {describe(schedule)}, Amsterdam time. You hear about {NOTIFY_LABEL[notify]}.</>}
      </p>
    </fieldset>
  );
}
