import React from "react";
import PublicLandingLive from "./PublicLandingLive.jsx";

const copy = {
  nl: {
    switch: "English", headline: "Een goede vondst zien voordat hij weg is.",
    intro: "Vertel wat je zoekt op Marktplaats. De Watcher leest nieuwe advertenties, beoordeelt wat past en mailt je de beste matches met een reden.",
    problemTitle: "Minder ruis in je zoekresultaten", problem: "Een opgeslagen zoekopdracht vindt dezelfde woorden, ook in accessoires en advertenties die niet passen. Een interessante advertentie kan daardoor tussen de meldingen verdwijnen.",
    demoTitle: "Bekijk hoe het werkt", demo: "Korte demo volgt zodra de opname klaar is.",
    stepsTitle: "Zo werkt het", steps: ["Beschrijf wat je zoekt in gewone woorden.", "Kies wanneer de Watcher nieuwe advertenties controleert.", "Ontvang alleen de scores die jij kiest, met een korte uitleg."],
    proofTitle: "Wat we hebben gemeten", proof: "In een evaluatie van 53 echte advertenties voor 6 zoekopdrachten was 86% van de gemailde 'goede' matches relevant; 78% van de relevante advertenties werd gevonden. Bij de strengere instelling 'geweldig' was dat 100% en 74%. Dit zijn medianen van drie runs, gemeten op 10 oktober 2026 met deels handmatig gecorrigeerde labels; dit is geen garantie voor elke zoekopdracht.",
    quoteTitle: "Reactie tijdens de demo", quote: "I pay 10 euros to get this application … I think I can be your first user.", quoteBy: "Vinod Kumar Bhovi, oprichter van DataBag, tijdens de demo. Dit was interesse, geen betaalde aankoop.",
    limitsTitle: "Goed om te weten", limits: "Marktplaats Watcher is een onafhankelijk project, niet verbonden aan Marktplaats. Het leest openbaar beschikbare advertenties. Matches kunnen gemist worden of verkeerd beoordeeld; jij beslist of je een verkoper benadert.",
    faqTitle: "Veelgestelde vragen", faq: [["Is dit een Marktplaats dienst?", "Nee. De Watcher is onafhankelijk en leest openbare advertenties."], ["Krijg ik elke advertentie?", "Nee. Je kiest welke scores een e-mail verdienen. De eerste controle legt alleen de huidige advertenties vast; meldingen gaan over nieuwe vondsten."], ["Wat kost het?", "De eerste 100 gebruikers krijgen 30 dagen gratis. Er is geen betaalkaart nodig."]],
    signup: "Maak gratis een zoekopdracht", foot: "Geen betaalkaart of appinstallatie nodig.",
  },
  en: {
    switch: "Nederlands", headline: "See the good listing before it is gone.",
    intro: "Tell us what you want on Marktplaats. Watcher reads new public listings, scores the fit and e-mails the best matches with a reason.",
    problemTitle: "Less noise in your search", problem: "A saved search matches the words you typed, including accessories and listings that miss the point. A worthwhile listing can get lost among those notices.",
    demoTitle: "See how it works", demo: "A short demo will appear here when the recording is ready.",
    stepsTitle: "How it works", steps: ["Describe what you want in plain words.", "Choose when Watcher checks new listings.", "Get only the scores you choose, with a short explanation."],
    proofTitle: "What we measured", proof: "In an evaluation of 53 real listings across 6 watches, 86% of e-mailed 'good' matches were relevant and 78% of relevant listings were found. With the stricter 'great' setting, those figures were 100% and 74%. These are medians of three runs, measured 10 October 2026 with some human-corrected labels; results vary by search.",
    quoteTitle: "From the live demo", quote: "I pay 10 euros to get this application … I think I can be your first user.", quoteBy: "Vinod Kumar Bhovi, DataBag founder, at the demo. This expressed interest, not a paid purchase.",
    limitsTitle: "What to know", limits: "Marktplaats Watcher is an independent project, not affiliated with Marktplaats. It reads public listings. It may miss or misjudge a match; you decide whether to contact a seller.",
    faqTitle: "Questions", faq: [["Is this a Marktplaats service?", "No. Watcher is independent and reads public listings."], ["Will I get every listing?", "No. You choose which scores deserve an e-mail. The first check only records current listings; alerts are for new ones."], ["What does it cost?", "The first 100 users get 30 days free. No card is needed."]],
    signup: "Set up a free watch", foot: "No card or app install needed.",
  },
};

export default function PublicLanding({ language }) {
  const c = copy[language];
  const other = language === "nl" ? "en" : "nl";
  return <div className="public-landing">
    <header className="public-bar"><a className="public-brand" href={`/${language}/`}>Marktplaats <strong>Watcher</strong></a>
      <a data-language-switch href={`/${other}/`} lang={other}>{c.switch}</a></header>
    <main>
      <section className="public-hero"><div><h1>{c.headline}</h1><p>{c.intro}</p><PublicLandingLive language={language} signup={c.signup} />
        <small>{c.foot}</small></div><div className="public-visual" role="img" aria-label={language === "nl" ? "Voorbeeld: een Mac mini scoort 9 op 10; een dockingstation 0 op 10" : "Example: a Mac mini scores 9 out of 10; a docking station scores 0 out of 10"}>
          <span>Mac mini 16GB · €230 <b>9/10</b></span><span>Docking station · €74 <b>0/10</b></span></div></section>
      <section><h2>{c.problemTitle}</h2><p>{c.problem}</p></section>
      <section><h2>{c.demoTitle}</h2><div className="public-video" role="img" aria-label={c.demo}><span>▶</span><p>{c.demo}</p></div></section>
      <section><h2>{c.stepsTitle}</h2><ol className="public-steps">{c.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section className="public-proof"><h2>{c.proofTitle}</h2><p>{c.proof} <a href="https://github.com/nunesdaryl/marktplaats-watcher/blob/main/evals/report.md">{language === "nl" ? "Bekijk het evaluatierapport" : "Read the evaluation report"}</a>.</p><blockquote>“{c.quote}”<footer>{c.quoteBy}</footer></blockquote></section>
      <section><h2>{c.limitsTitle}</h2><p>{c.limits}</p></section>
      <section><h2>{c.faqTitle}</h2>{c.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
    </main><footer className="public-footer">© Marktplaats Watcher · {language === "nl" ? "Onafhankelijk project" : "Independent project"}</footer>
  </div>;
}
