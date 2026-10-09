import React, { useEffect, useState } from "react";

const VARIANTS = new Set(["mini", "lite", "pro", "max", "plus", "ultra", "slim", "digital", "oled", "xl", "kids", "kinder", "children"]);
const FILLER = new Set(["late", "model", "met", "voor", "van", "de", "het", "een", "en", "in", "te", "koop", "nieuw", "new", "used", "zgan", "als", "with", "for", "the", "and"]);

export function suggestedWords(title = "", query = "", mustInclude = "") {
  const words = (value) => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const asked = new Set(words(`${query} ${mustInclude}`));
  const rank = (word) => {
    if (VARIANTS.has(word)) return 0;
    const year = Number(word);
    if ((/^\d{4}$/.test(word) && year >= 1990 && year <= 2030) ||
      (/^[a-z]+\d+[a-z\d]*$/.test(word) && !/^(?:ddr\d+|lpddr\d+|\d+(?:gb|tb|mb))$/.test(word))) return 1;
    if (/^(?:ddr\d+|lpddr\d+|\d+(?:gb|tb|mb)|hdd|ssd|nvme|ram)$/.test(word)) return 2;
    return 3;
  };
  return [...new Set(words(title).filter((word) => word.length >= 3 && word.length <= 30 &&
    !asked.has(word) && !FILLER.has(word)))].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
}

/** An explicit watch change after a saved Not right reason. Each button confirms one change. */
export default function RatingFix({ reasons = [], alert, onFix, onUndo }) {
  const suggestions = suggestedWords(alert?.title, alert?.query, alert?.mustInclude);
  const [word, setWord] = useState(suggestions[0] ?? "");
  const [price, setPrice] = useState(alert?.priceEur != null ? Math.max(1, Math.min(alert.priceEur - 5,
    alert.maxPriceEur != null ? alert.maxPriceEur - 5 : Infinity)) : "");
  const [saved, setSaved] = useState("");
  const [until, setUntil] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!until) return;
    const timer = setTimeout(() => setUntil(0), Math.max(0, until - Date.now()));
    return () => clearTimeout(timer);
  }, [until]);
  async function apply(args) {
    setBusy(true); setError("");
    try { const result = await onFix(args); setSaved(result.message); setUntil(result.undoUntil); }
    catch (e) { setError(e.data ?? "That didn't save. Try again."); }
    finally { setBusy(false); }
  }
  async function undo() {
    setBusy(true); setError("");
    try { await onUndo(); setSaved("Undone."); setUntil(0); }
    catch (e) { setError(e.data ?? "Undo didn't work."); }
    finally { setBusy(false); }
  }
  const notify = alert?.notify;
  return <div className="rating-fix">
    {!saved && <>
      {reasons.includes("not_asked") && suggestions.length > 0 && <div>
        <label>Skip listings with <input aria-label="Word to skip" value={word} maxLength={30}
          list={`rating-words-${alert?.title?.replace(/\W/g, "")}`} onChange={(e) => setWord(e.target.value)} /></label>
        <datalist id={`rating-words-${alert?.title?.replace(/\W/g, "")}`}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
        <button type="button" className="button small-button" disabled={busy || !word.trim() || alert?.excludeWords?.includes(word.trim().toLowerCase())}
          onClick={() => apply({ kind: "exclude", word: word.trim() })}>Skip listings with '{word.trim()}'</button>
      </div>}
      {reasons.includes("price") && alert?.priceEur != null && alert.priceEur > 1 && (alert.maxPriceEur == null || alert.maxPriceEur > 1) && <div>
        <label>New maximum (€) <input aria-label="New maximum price" type="number" min="1" max={Math.min(alert.priceEur, alert.maxPriceEur ?? Infinity) - 1}
          value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <button type="button" className="button small-button" disabled={busy || !Number.isInteger(Number(price)) || Number(price) < 1 || Number(price) >= alert.priceEur || (alert.maxPriceEur != null && Number(price) >= alert.maxPriceEur)}
          onClick={() => apply({ kind: "price", priceEur: Number(price) })}>Lower my maximum to €{price}</button>
      </div>}
      {reasons.includes("score_too_high") && notify !== "great" && <button type="button" className="button small-button" disabled={busy}
        onClick={() => apply({ kind: "notify" })}>Only e-mail great matches</button>}
      {reasons.includes("score_too_low") && notify === "great" && <button type="button" className="button small-button" disabled={busy}
        onClick={() => apply({ kind: "notify" })}>Also e-mail good matches</button>}
    </>}
    {saved && <p role="status">{saved} {until > 0 && <button type="button" className="link-button small" disabled={busy} onClick={undo}>Undo</button>}</p>}
    {error && <p className="error small" role="alert">{error}</p>}
  </div>;
}
