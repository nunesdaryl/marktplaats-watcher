"use client";
import React, { useEffect, useState } from "react";
import { ConvexReactClient, ConvexProvider, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { captureLanding } from "./lib/landingAttribution.js";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

export function Live({ language, signup }) {
  const capacity = useQuery(api.beta.capacity);
  const [href, setHref] = useState(`/?landing_lang=${language}`);
  useEffect(() => {
    document.documentElement.lang = language;
    const first = captureLanding(window.location.search, language);
    const params = new URLSearchParams();
    params.set("landing_lang", first.landingLanguage);
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) if (first[key]) params.set(key, first[key]);
    setHref(`/?${params}`);
    document.querySelectorAll("[data-language-switch]").forEach((link) => { link.search = window.location.search; });
  }, [language]);
  return <div className="public-action">
    {capacity && <p className="public-places" role="status">{language === "nl"
      ? capacity.left > 0 ? `${capacity.left} van ${capacity.cap} founding plekken over` : `Alle ${capacity.cap} founding plekken bezet; meld je aan voor de wachtlijst`
      : capacity.left > 0 ? `${capacity.left} of ${capacity.cap} founding places left` : `All ${capacity.cap} founding places taken; join the waitlist`}</p>}
    <a className="public-cta" href={href}>{signup}</a>
  </div>;
}

export default function PublicLandingLive(props) {
  return client ? <ConvexProvider client={client}><Live {...props} /></ConvexProvider> :
    <a className="public-cta" href={`/?landing_lang=${props.language}`}>{props.signup}</a>;
}
