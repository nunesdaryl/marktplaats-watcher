import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import ArchivedView from "./ArchivedView.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.stubGlobal("React", React);

test("archived alerts show their title, watch and restore menu", () => {
  const responses = [[], [], [{ _id: "a1", title: "Mac mini", watchLabel: "Home office",
    archivedAt: Date.now(), url: "https://example.com" }]];
  let at = 0;
  vi.mocked(useQuery).mockImplementation(() => responses[at++]);
  const html = renderToStaticMarkup(<ArchivedView actions={{ alertItems: () => [{ label: "Restore", icon: "restore", onSelect: vi.fn() }] }} />);
  expect(html).toContain('>Alerts</h2>');
  expect(html).toContain('Mac mini');
  expect(html).toContain('Home office · Archived');
  expect(html).toContain('Options for Mac mini');
});
