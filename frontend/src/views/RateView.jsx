// The page behind the alert e-mail's "Good match? Yes · Not right" links. No sign-in: the link's code rates only
// that one alert (convex/ratings.ts). The page records the answer itself (not the link), so mail scanners that open
// links without running pages don't create ratings.
import { useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import Logo from "../components/Logo.jsx";
import WhyNotRight from "../components/WhyNotRight.jsx";

export default function RateView() {
  const params = useSearchParams();
  const alertId = params.get("a") ?? "", token = params.get("t") ?? "";
  const [verdict, setVerdict] = useState(params.get("v") === "not_right" ? "not_right" : "good");
  const rate = useMutation(api.ratings.rateWithToken);
  const explain = useMutation(api.ratings.explainWithToken);
  const fix = useMutation(api.ratings.fixWithToken);
  const undo = useMutation(api.ratings.undoWithToken);
  const [state, setState] = useState("saving");   // saving | saved | explained | error
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  const record = (v) => rate({ alertId, token, verdict: v })
    .then((a) => { setAlert(a); setVerdict(v); setState("saved"); })
    .catch((e) => { setError(e.data ?? "That didn't work. Try again from the e-mail, or rate it in the app under Alerts."); setState("error"); });

  useEffect(() => {
    if (started.current) return;       // once, also in React's development double-run
    started.current = true;
    if (!alertId || !token) { setError("This link is incomplete. Rate the alert in the app under Alerts."); setState("error"); return; }
    record(verdict);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="rate-page">
      <div className="rate-card">
        <a href="/" className="rate-brand"><Logo size={36} /><span className="wordmark">Marktplaats <b>Watcher</b></span></a>
        {alert && <p className="rate-listing">{alert.title}{alert.score !== null ? <span className="mono"> · scored {alert.score}/10</span> : ""}</p>}
        {state === "saving" && <p className="muted" role="status">Saving your answer…</p>}
        {state === "error" && <p className="error" role="alert">{error}</p>}
        {state === "saved" && verdict === "good" && (
          <>
            <h1>Thanks.</h1>
            <p className="muted">Thanks — this watch will use it from the next check.</p>
            <button className="link-button" onClick={() => record("not_right")}>Actually, it wasn't right</button>
          </>
        )}
        {state === "saved" && verdict === "not_right" && (
          <><p className="muted">Thanks — this watch will use it from the next check.</p><WhyNotRight alert={alert} onFix={(args) => fix({ alertId, token, ...args })}
            onUndo={() => undo({ alertId, token })}
            onSend={(why) => explain({ alertId, token, ...why }).catch((e) => { setError(e.data ?? "That didn't send. Try again."); throw e; })} />
            {error && <p className="error" role="alert">{error}</p>}</>
        )}
        {state === "explained" && (
          <>
            <h1>Thanks, that helps.</h1>
            <p className="muted">Thanks — this watch will use it from the next check.</p>
          </>
        )}
        <a className="button tinted rate-open" href="/alerts/">Open my alerts</a>
      </div>
    </main>
  );
}
