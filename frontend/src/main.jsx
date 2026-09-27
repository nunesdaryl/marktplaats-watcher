import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const convexUrl = import.meta.env.VITE_CONVEX_URL;

function NotConfigured() {
  return (
    <div className="setup">
      <h1>Almost there</h1>
      <p>This build is missing <code>VITE_CLERK_PUBLISHABLE_KEY</code> or <code>VITE_CONVEX_URL</code>.
        Set them as described in the README, then build again.</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {clerkKey && convexUrl ? (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
        <ConvexProviderWithClerk client={new ConvexReactClient(convexUrl)} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    ) : <NotConfigured />}
  </StrictMode>,
);
