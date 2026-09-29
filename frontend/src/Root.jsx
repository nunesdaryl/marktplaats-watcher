import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Analytics } from "@vercel/analytics/next";
import App from "./App.jsx";
import "./lib/errors.js";   // remembers the last few errors, sent along with feedback
import { RouterBridge } from "./lib/router.js";
import { useTheme } from "./lib/theme.js";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Clerk's sign-in and account screens in the Sieve colours (docs/design/sieve/README.md, "Clerk sign-in")
const clerkLook = (dark) => ({
  variables: {
    borderRadius: "6px", fontFamily: "Geist, system-ui, sans-serif",
    ...(dark
    ? { colorPrimary: "#4fd1bf", colorTextOnPrimaryBackground: "#06201c", colorBackground: "#1e1c1a", colorText: "#ece9e4",
        colorTextSecondary: "#a9a49c", colorInputBackground: "#252321", colorInputText: "#ece9e4", colorNeutral: "#ece9e4" }
    : { colorPrimary: "#0d6b62", colorTextOnPrimaryBackground: "#ffffff", colorBackground: "#fbfaf7", colorText: "#1b1a18",
        colorTextSecondary: "#5b5751", colorInputBackground: "#eeebe6", colorInputText: "#1b1a18", colorNeutral: "#1b1a18" }),
  },
  // The account menu's items ("Manage account", "Sign out") use their own colour; in dark mode it was dark on dark
  elements: {
    userButtonPopoverActionButton: { color: dark ? "#ece9e4" : "#1b1a18" },
    userButtonPopoverCustomItemButton: { color: dark ? "#ece9e4" : "#1b1a18", opacity: 1 },
    userButtonPopoverActionButtonIcon: { color: dark ? "#a9a49c" : "#5b5751" },
  },
});

export default function Root() {
  const dark = useTheme().theme === "dark";   // the device setting, or the sun/moon choice
  if (!clerkKey || !convex) {
    return (
      <div className="setup">
        <h1>Almost there</h1>
        <p>This build is missing <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> or <code>NEXT_PUBLIC_CONVEX_URL</code>.
          Set them as described in the README, then build again.</p>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/" appearance={clerkLook(dark)}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <RouterBridge />
        <App />
        {/* Vercel Web Analytics: cookieless visitor and page counts, also for signed-out visitors. Ids are left out. */}
        <Analytics beforeSend={(e) => ({ ...e, url: e.url.split("?")[0] })} />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
