"use client";
import dynamic from "next/dynamic";
import Boot from "../src/Boot.jsx";

// Everything behind the login runs in the browser (Clerk + Convex live connection), so it isn't prerendered.
// Until it has loaded, Boot shows: the landing page on "/", a quiet placeholder elsewhere.
// (dynamic() must be called at module level: inside a component it would create a new component every render.)
const load = () => import("../src/Root.jsx");
const RootWithLanding = dynamic(load, { ssr: false, loading: () => <Boot landing /> });
const RootWithPlaceholder = dynamic(load, { ssr: false, loading: () => <Boot /> });

export default function ClientRoot({ landing = false }) {
  return landing ? <RootWithLanding /> : <RootWithPlaceholder />;
}
