import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import Sheet from "./Sheet.jsx";

export default function OfferSheet({ listing, watchId, onClose }) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("nl");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/offer/help", {
          method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
          body: JSON.stringify({ title: listing.title, url: listing.url,
            priceEur: listing.price_eur ?? listing.priceEur, description: listing.description ?? "", watchId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.answer ?? "Offer help is unavailable. Try again.");
        setDraft(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message);
      }
    })();
    return () => controller.abort();
  // The sheet is mounted for one listing. Parent refreshes may replace its object while it is open.
  }, []);

  const message = language === "nl" ? draft?.messageNl : draft?.messageEn;
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch { setError("Couldn't copy the message. Select and copy it instead."); }
  }
  return <Sheet title="Help me make an offer" onClose={onClose}>
    <p className="hint">You send this yourself on Marktplaats. We never contact sellers.</p>
    {!draft && !error && <p role="status">Preparing your offer…</p>}
    {error && <p role="alert">{error}</p>}
    {draft && <div className="offer-help">
      <div><strong>Opening offer: €{draft.openingEur}</strong><p>{draft.openingReason}</p></div>
      <div><strong>Walk-away maximum: €{draft.maxEur}</strong><p>{draft.maxReason}</p></div>
      <button type="button" className="link-button" onClick={() => { setLanguage(language === "nl" ? "en" : "nl"); setCopied(false); }}>
        {language === "nl" ? "Show English" : "Show Dutch"}
      </button>
      <label htmlFor="offer-message">Message to copy</label>
      <textarea id="offer-message" readOnly value={message} rows={4} />
      <button type="button" className="button tinted" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
    </div>}
  </Sheet>;
}
