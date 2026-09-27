"use client";
import dynamic from "next/dynamic";

// Everything behind the login runs in the browser (Clerk + Convex live connection), so it isn't prerendered.
const Root = dynamic(() => import("../src/Root.jsx"), { ssr: false, loading: () => <div className="loading">Loading…</div> });

export default function ClientRoot() {
  return <Root />;
}
