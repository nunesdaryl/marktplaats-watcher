const KEY = "mw:first-landing";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign"];

export function captureLanding(search, language, storage) {
  try {
    storage ??= sessionStorage;
    const previous = storage.getItem(KEY);
    if (previous) return JSON.parse(previous);
  } catch {}
  const params = new URLSearchParams(search);
  const first = { landingLanguage: language };
  for (const field of FIELDS) {
    const value = params.get(field)?.trim().slice(0, 100);
    if (value) first[field] = value;
  }
  try { (storage ?? sessionStorage).setItem(KEY, JSON.stringify(first)); } catch {}
  return first;
}

export function signupAttribution(storage) {
  try {
    storage ??= sessionStorage;
    const saved = storage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const language = params.get("landing_lang");
    if (language === "nl" || language === "en") return captureLanding(window.location.search, language, storage);
  }
  return {};
}

export function clearSignupAttribution() {
  try { sessionStorage.removeItem(KEY); } catch {}
}
