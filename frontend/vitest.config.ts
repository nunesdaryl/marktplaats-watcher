import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",            // the same kind of runtime Convex functions run in
    server: { deps: { inline: ["convex-test"] } },
  },
});
