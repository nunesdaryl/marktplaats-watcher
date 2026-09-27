import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from "./App.jsx";
import { RouterBridge } from "./lib/router.js";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function Root() {
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
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <RouterBridge />
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
