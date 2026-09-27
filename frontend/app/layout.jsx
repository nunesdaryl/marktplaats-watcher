import "../src/styles.css";

const title = "Marktplaats Watcher";
const description = "Marktplaats alerts that read the listings first: say what you want, pick when to check, and get only the good ones, each with a reason.";

export const metadata = {
  metadataBase: new URL("https://marktplaats-watcher.vercel.app"),
  title,
  description,
  openGraph: {
    type: "website", url: "/", title, siteName: title,
    description: "Say what you want, pick when to check, and get only the good listings, each with a score and the reason for it.",
    images: [{ url: "/og-image.png", width: 1200, height: 627,
      alt: "Check Marktplaats for a Mac mini under €500 every morning at 8 and e-mail me the good ones. A 9/10 match is e-mailed, a 0/10 docking station is skipped." }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#212121" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions add attributes to <body> before React loads */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
