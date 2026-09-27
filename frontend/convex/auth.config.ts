import type { AuthConfig } from "convex/server";

// Clerk signs the "convex" JWT; Convex checks it against this issuer (set in the Convex dashboard env).
export default {
  providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" }],
} satisfies AuthConfig;
