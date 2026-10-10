const LIMIT = 20;

export function broadWatchMessage(volumeNote, maxPriceEur, notify) {
  const count = /^About (\d+) listings match now\b/.exec(volumeNote ?? "");
  if (count && Number(count[1]) >= 1000) {
    return "This search is broad: many listings match right now. Add a brand, model or price limit, or choose 'good matches'.";
  }
  const estimate = /\b(about|at least) (\d+) new listings per check\b/.exec(volumeNote ?? "");
  if (estimate && Number(estimate[2]) > LIMIT) {
    return `This search is broad: ${estimate[1]} ${estimate[2]} new listings per check, more than we can score each time. Add a brand, model or price limit, or choose 'good matches'.`;
  }
  if (!maxPriceEur && notify === "all") {
    return "This search is broad: without a price limit, every new listing could fill your inbox. Add a brand, model or price limit, or choose 'good matches'.";
  }
  return null;
}

export default function BroadWatchWarning({ message, onPrice, onGood, showGood = true }) {
  if (!message) return null;
  return <div className="broad-watch-warning" role="status">
    <p className="warn">{message}</p>
    <div className="suggestions left">
      <button type="button" className="chip" onClick={onPrice}>Add max price</button>
      {showGood && <button type="button" className="chip" onClick={onGood}>Choose good matches</button>}
    </div>
  </div>;
}
