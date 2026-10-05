import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import WatchesView from "./WatchesView.jsx";

vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.stubGlobal("React", React);

test("first-use Watches tab explains when watches appear and has one create action", () => {
  const html = renderToStaticMarkup(<WatchesView watches={[]} actions={{}} onNew={vi.fn()} />);
  expect(html).toContain("Your watches appear here after you create them.");
  expect(html.match(/Create a watch/g)).toHaveLength(1);
  expect(html).not.toContain('>New</button>');
});

test("populated Watches tab keeps its usual new action without an empty-state action", () => {
  const watch = { _id: "w1", title: "Mac mini", active: true, summary: "Under €300", alerts: [] };
  const html = renderToStaticMarkup(<WatchesView watches={[watch]} actions={{ watchItems: () => [] }} onNew={vi.fn()} />);
  expect(html).toContain('>New</button>');
  expect(html).not.toContain("Create a watch");
});
