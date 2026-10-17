import { beforeEach, expect, test, vi } from "vitest";
import { useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { useItemActions } from "./actions.js";

vi.mock("convex/react", () => ({ useMutation: vi.fn() }));

let archive;
let archiveAll;
let watchArchive;
let toast;
let actions;

beforeEach(() => {
  archive = vi.fn(() => Promise.resolve());
  archiveAll = vi.fn();
  watchArchive = vi.fn(() => Promise.resolve());
  toast = vi.fn();
  vi.mocked(useMutation).mockImplementation((reference) => {
    const name = getFunctionName(reference);
    return name === "alerts:setArchived" ? archive : name === "alerts:archiveAll" ? archiveAll :
      name === "watches:setArchived" ? watchArchive : vi.fn();
  });
  actions = useItemActions({ toast, route: { section: "alerts" } });
});

test("archiving one alert calls the mutation and shows the archive toast", async () => {
  await actions.archiveAlert("a1");
  expect(archive).toHaveBeenCalledWith({ id: "a1", archived: true });
  expect(toast).toHaveBeenCalledWith("Alert archived. Find it under Archived.");
});

test("archive all repeats 500-row batches and reports the total", async () => {
  archiveAll.mockResolvedValueOnce({ archived: 500 }).mockResolvedValueOnce({ archived: 1 });
  await actions.archiveAllAlerts();
  expect(archiveAll).toHaveBeenCalledTimes(2);
  expect(toast).toHaveBeenCalledWith("501 alerts archived. Find them under Archived.");
});

test("archive all uses singular copy for one alert", async () => {
  archiveAll.mockResolvedValueOnce({ archived: 1 });
  await actions.archiveAllAlerts();
  expect(toast).toHaveBeenCalledWith("1 alert archived. Find it under Archived.");
});

test("restore puts an alert back through the same mutation", async () => {
  actions.alertItems({ _id: "a1" })[0].onSelect();
  await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("Alert restored."));
  expect(archive).toHaveBeenCalledWith({ id: "a1", archived: false });
});

test("a watch restore refusal appears in the existing toast", async () => {
  const message = "You have 5 watches. Archive or delete one to restore this.";
  watchArchive.mockRejectedValueOnce({ data: message });
  actions.watchItems({ _id: "w1", archivedAt: Date.now() })[0].onSelect();
  await vi.waitFor(() => expect(toast).toHaveBeenCalledWith(message));
  expect(watchArchive).toHaveBeenCalledWith({ id: "w1", archived: false });
});
