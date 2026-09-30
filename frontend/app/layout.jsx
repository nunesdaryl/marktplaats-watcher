import "../src/styles.css";
import { bootScript } from "../src/lib/boot.js";
import ClientRoot from "./ClientRoot.jsx";

const title = "Marktplaats Watcher";
const description = "Marktplaats' saved search sends every ad with your words. This reads each new listing and e-mails only the ones worth a look, with a score and the reason, when you choose.";

export const metadata = {
  metadataBase: new URL("https://marktplaats-watcher.vercel.app"),
  title,
  description,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website", url: "/", title, siteName: title,
    description: "Not another saved search: say what you want, pick when to check, and get only the new listings worth a look, each with a score and the reason.",
    images: [{ url: "/og-image.png", width: 1200, height: 627,
      alt: "Check Marktplaats for a Mac mini under €500 every morning at 8 and e-mail me good matches, with the reason. A 9/10 match is e-mailed, a 0/10 docking station is skipped." }],
  },
  twitter: { card: "summary_large_image" },
  // Generated from src/brand/logo.js by `npm run brand`
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-icon.png" },
  // Shared on LinkedIn and at the demo, not advertised to search engines (Marktplaats ToS art. 7.3 exposure)
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint: returning signed-in users skip the landing page flash (see src/Boot.jsx) */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      {/* suppressHydrationWarning: browser extensions add attributes to <body> before React loads */}
      <body suppressHydrationWarning>
        <ClientRoot />
        {children}
      </body>
    </html>
  );
}
