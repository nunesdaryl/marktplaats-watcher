import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { go } from "./router.js";
import { track } from "./track.js";

// The same "…" menu items everywhere a chat or watch appears (sidebar, phone lists, watch page, archive).
// ui: { openSheet, newWatch, toast, route, startRename? }
export function useItemActions(ui) {
  const chat = {
    pin: useMutation(api.chats.setPinned), archive: useMutation(api.chats.setArchived), remove: useMutation(api.chats.remove),
  };
  const watch = {
    pin: useMutation(api.watches.setPinned), archive: useMutation(api.watches.setArchived), remove: useMutation(api.watches.remove),
    update: useMutation(api.watches.update), checkNow: useMutation(api.watches.checkNow),
  };
  const alert = {
    archive: useMutation(api.alerts.setArchived), archiveAll: useMutation(api.alerts.archiveAll),
  };
  const run = (fn, done) => fn().then(done).catch((e) => ui.toast(e.data ?? "That didn't work. Try again."));
  const leaveIfOpen = (section, id) => { if (ui.route.section === section && ui.route.id === id) go(section === "c" ? "/" : "/watches"); };

  const chatItems = (c, { inline } = {}) => c.archivedAt ? [
    { label: "Restore", icon: "restore", onSelect: () => run(() => chat.archive({ chatId: c._id, archived: false }), () => ui.toast("Chat restored.")) },
    { label: "Delete", icon: "trash", danger: true, confirm: true, onSelect: () => run(() => chat.remove({ chatId: c._id })) },
  ] : [
    { label: "Rename", icon: "edit", onSelect: () => (inline && ui.startRename ? ui.startRename("chat", c._id) : ui.openSheet({ type: "rename", kind: "chat", item: c })) },
    { label: c.pinned ? "Unpin" : "Pin", icon: "pin", onSelect: () => run(() => chat.pin({ chatId: c._id, pinned: !c.pinned })) },
    { label: "Move to folder…", icon: "folder", onSelect: () => ui.openSheet({ type: "move", kind: "chat", item: c }) },
    "divider",
    { label: "Archive", icon: "archive", onSelect: () => run(() => chat.archive({ chatId: c._id, archived: true }), () => { leaveIfOpen("c", c._id); ui.toast("Chat archived. Find it under Archived."); }) },
    { label: "Delete", icon: "trash", danger: true, confirm: "Delete this chat?", onSelect: () => run(() => chat.remove({ chatId: c._id }), () => leaveIfOpen("c", c._id)) },
  ];

  const watchFields = (w) => ({ query: w.query, mustInclude: w.mustInclude, maxPriceEur: w.maxPriceEur, postcode: w.postcode,
    maxDistanceKm: w.maxDistanceKm, schedule: w.schedule, notify: w.notify });

  const watchItems = (w, { inline, full } = {}) => w.archivedAt ? [
    { label: "Restore", icon: "restore", onSelect: () => run(() => watch.archive({ id: w._id, archived: false }), () => ui.toast("Watch restored. It's paused: press Resume to start checking again.")) },
    { label: "Delete", icon: "trash", danger: true, confirm: true, onSelect: () => run(() => watch.remove({ id: w._id })) },
  ] : [
    { label: "Rename", icon: "edit", onSelect: () => (inline && ui.startRename ? ui.startRename("watch", w._id) : ui.openSheet({ type: "rename", kind: "watch", item: w })) },
    { label: w.pinned ? "Unpin" : "Pin", icon: "pin", onSelect: () => run(() => watch.pin({ id: w._id, pinned: !w.pinned })) },
    !full && { label: "Edit filters and schedule", icon: "edit", onSelect: () => ui.openSheet({ type: "watch", mode: "edit", initial: w, watchId: w._id }) },
    !full && { label: w.active ? "Pause" : "Resume", icon: w.active ? "pause" : "play", onSelect: () => run(() => watch.update({ id: w._id, active: !w.active }), () => track(w.active ? "watch_paused" : "watch_resumed")) },
    { label: "Duplicate", icon: "copy", onSelect: () => ui.newWatch(watchFields(w)) },
    { label: "Move to folder…", icon: "folder", onSelect: () => ui.openSheet({ type: "move", kind: "watch", item: w }) },
    "divider",
    { label: "Archive", icon: "archive", onSelect: () => run(() => watch.archive({ id: w._id, archived: true }), () => { track("watch_archived"); leaveIfOpen("w", w._id); ui.toast("Watch archived and paused. Find it under Archived."); }) },
    { label: "Delete", icon: "trash", danger: true, confirm: "Delete this watch?", onSelect: () => run(() => watch.remove({ id: w._id }), () => { track("watch_deleted"); leaveIfOpen("w", w._id); }) },
  ];

  const archiveAlert = (id) => run(() => alert.archive({ id, archived: true }),
    () => ui.toast("Alert archived. Find it under Archived."));
  const archiveAllAlerts = async () => {
    let total = 0;
    try {
      let archived;
      do {
        ({ archived } = await alert.archiveAll({}));
        total += archived;
      } while (archived === 500);
      ui.toast(total === 1 ? "1 alert archived. Find it under Archived." :
        `${total} alerts archived. Find them under Archived.`);
    } catch (e) { ui.toast(e.data ?? "That didn't work. Try again."); }
  };
  const alertItems = (a) => [
    { label: "Restore", icon: "restore", onSelect: () => run(() => alert.archive({ id: a._id, archived: false }),
      () => ui.toast("Alert restored.")) },
  ];

  return { chatItems, watchItems, alertItems, archiveAlert, archiveAllAlerts };
}
