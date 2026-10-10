"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Boot from "../src/Boot.jsx";

// The whole app runs in the browser (Clerk + Convex live connection) and is mounted ONCE, from the root layout,
// so navigating between pages keeps its state (a streaming answer, an open search, an inline rename…).
// Until it has loaded, Boot shows: the landing page on "/", a quiet placeholder elsewhere.
// (dynamic() must be called at module level: inside a component it would create a new component every render.)
const load = () => import("../src/Root.jsx");
const RootWithLanding = dynamic(load, { ssr: false, loading: () => <Boot landing /> });
const RootWithPlaceholder = dynamic(load, { ssr: false, loading: () => <Boot /> });

export default function ClientRoot() {
  const pathname = usePathname();
  // Decided once, on the first render: switching components later would remount the app
  const [landing] = useState(() => pathname === "/");
  if (pathname === "/nl" || pathname === "/nl/" || pathname === "/en" || pathname === "/en/") return null;
  return landing ? <RootWithLanding /> : <RootWithPlaceholder />;
}
