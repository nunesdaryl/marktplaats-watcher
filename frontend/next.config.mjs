import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// Production: a static export (frontend/out) that Vercel serves next to the Python API, and that the Docker
// image serves from FastAPI. Development: `next dev` proxies /api to FastAPI on :8000 (rewrites only exist in dev,
// because a static export can't have them).
export default function config(phase) {
  const base = { trailingSlash: true, reactStrictMode: true, images: { unoptimized: true } };
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // skipTrailingSlashRedirect: otherwise /api/chat/stream is first redirected to …/stream/, which FastAPI doesn't serve
    return { ...base, skipTrailingSlashRedirect: true,
      rewrites: async () => [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }] };
  }
  return { ...base, output: "export" };
}
