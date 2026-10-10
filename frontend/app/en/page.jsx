import PublicLanding from "../../src/PublicLanding.jsx";

export const metadata = { title: "Marktplaats Watcher | Find better second-hand deals", description: "Describe what you want. Get relevant new Marktplaats listings by e-mail with a score and explanation.", alternates: { canonical: "/en/", languages: { nl: "/nl/", en: "/en/" } }, openGraph: { url: "/en/", images: [{ url: "/og-image.png", width: 1200, height: 627, alt: "Marktplaats Watcher example of a relevant Mac mini match" }] } };
export default function Page() { return <PublicLanding language="en" />; }
