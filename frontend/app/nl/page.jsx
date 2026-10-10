import PublicLanding from "../../src/PublicLanding.jsx";

export const metadata = { title: "Marktplaats Watcher | Vind betere tweedehands deals", description: "Beschrijf wat je zoekt. Krijg alleen relevante nieuwe Marktplaats advertenties per e-mail, met een score en uitleg.", alternates: { canonical: "/nl/", languages: { nl: "/nl/", en: "/en/" } }, openGraph: { url: "/nl/", images: [{ url: "/og-image.png", width: 1200, height: 627, alt: "Marktplaats Watcher voorbeeld van een relevante Mac mini match" }] } };
export default function Page() { return <PublicLanding language="nl" />; }
