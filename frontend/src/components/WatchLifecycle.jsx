import { MIN_SCORE, describe } from "../../convex/schedule";
import Icon from "./Icon.jsx";

/** A short explanation at the point where a new watch is set up. */
export default function WatchLifecycle({ schedule, notify }) {
  return (
    <details className="watch-lifecycle">
      <summary>What happens after I start watching? <Icon name="chevron" size={16} /></summary>
      <div className="watch-lifecycle-body">
        <p>The first check quietly notes what's already listed. We won't e-mail you about those older listings.</p>
        <p>After that, we check {describe(schedule)} (Amsterdam time). New listings get a score out of 10, based on how well they match your search and price.</p>
        <p>{notify === "all"
          ? "We'll e-mail you every new listing that fits your filters, with its score and the reason."
          : `We'll e-mail you new listings scoring ${MIN_SCORE[notify]} or higher, with the reason.`}</p>
      </div>
    </details>
  );
}
