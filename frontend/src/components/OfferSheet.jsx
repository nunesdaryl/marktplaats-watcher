import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet.jsx";
import { track } from "../lib/track.js";

export function isMarktplaatsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.marktplaats.nl" && !url.username && !url.password;
  } catch { return false; }
}

export default function OfferSheet({ listing, watchId, onClose }) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("nl");
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const messageRef = useRef(null);
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
  const readyText = draft ? `€${draft.openingEur}\n${message}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(manualCopy ? readyText : message);
      setCopied(true);
    } catch { setError("Couldn't copy the offer. Select and copy it instead."); messageRef.current?.select(); }
  }
  async function handoff() {
    // Only ever open a real Marktplaats listing page (guards against an odd path turning into another host).
    if (!isMarktplaatsUrl(listing.url)) { setError("This listing link doesn't look like Marktplaats, so it wasn't opened."); return; }
    // Both calls start during the tap; awaiting clipboard permission first can block a new tab on phones.
    let copiedText;
    try { copiedText = navigator.clipboard?.writeText(readyText); } catch { /* manual copy below */ }
    window.open(listing.url, "_blank", "noopener,noreferrer");
    track("bid_handoff", { alertId: listing._id, priceType: listing.price_type ?? listing.priceType,
      amount: draft.openingEur });
    try {
      if (!copiedText) throw new Error("Clipboard unavailable");
      await copiedText;
      setCopied(true);
    } catch {
      setManualCopy(true);
      setError("Couldn't copy the offer. Select and copy it below.");
      if (messageRef.current) messageRef.current.value = readyText;
      messageRef.current?.select();
    }
  }
  return <Sheet title="Help me make an offer" onClose={onClose}>
    <p className="hint">You send this yourself on Marktplaats. We never contact sellers.</p>
    {!draft && !error && <p role="status">Preparing your offer…</p>}
    {error && <p role="alert">{error}</p>}
    {draft && <div className="offer-help">
      <div><strong>Opening offer: €{draft.openingEur}</strong><p>{draft.openingReason}</p></div>
      <div><strong>Walk-away maximum: €{draft.maxEur}</strong><p>{draft.maxReason}</p></div>
      <button type="button" className="link-button" onClick={() => { setLanguage(language === "nl" ? "en" : "nl"); setCopied(false); setManualCopy(false); }}>
        {language === "nl" ? "Show English" : "Show Dutch"}
      </button>
      <label htmlFor="offer-message">{manualCopy ? "Offer to copy" : "Message to copy"}</label>
      <textarea id="offer-message" ref={messageRef} readOnly value={manualCopy ? readyText : message} rows={4} />
      <button type="button" className="button tinted" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      <button type="button" className="button primary" onClick={handoff}>Bid €{draft.openingEur} on Marktplaats</button>
      <p className="hint">Tap 'Bieden' on Marktplaats and paste.</p>
    </div>}
  </Sheet>;
}
