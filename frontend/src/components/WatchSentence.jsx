import { NOTIFY_LABEL, describe } from "../../convex/schedule";

/** The signature line: "Checking Marktplaats for [mac mini, under €500] [every 3 hours], e-mailing [good matches]." */
export default function WatchSentence({ label, schedule, notify, paused }) {
  if (paused) return <p className="sentence small">Paused. Resume to keep checking for <mark>{label}</mark>.</p>;
  return (
    <p className="sentence small">
      Checking Marktplaats for <mark>{label}</mark> <mark>{describe(schedule)}</mark>, e-mailing you{" "}
      <mark>{NOTIFY_LABEL[notify]}</mark>.
    </p>
  );
}
