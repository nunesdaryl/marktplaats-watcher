import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App.jsx";
import { RouterBridge, useMediaQuery } from "./lib/router.js";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Clerk's sign-in and account screens in the Sieve colours (docs/design/sieve/README.md, "Clerk sign-in")
const clerkLook = (dark) => ({
  variables: {
    borderRadius: "6px", fontFamily: "Geist, system-ui, sans-serif",
    ...(dark
    ? { colorPrimary: "#4fd1bf", colorTextOnPrimaryBackground: "#06201c", colorBackground: "#1e1c1a", colorText: "#ece9e4",
        colorTextSecondary: "#a9a49c", colorInputBackground: "#252321", colorInputText: "#ece9e4" }
    : { colorPrimary: "#0d6b62", colorTextOnPrimaryBackground: "#ffffff", colorBackground: "#fbfaf7", colorText: "#1b1a18",
        colorTextSecondary: "#5b5751", colorInputBackground: "#eeebe6", colorInputText: "#1b1a18" }),
  },
});

export default function Root() {
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
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
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
