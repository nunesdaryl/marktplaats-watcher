// ChatGPT-style date groups for the chat list: Today, Yesterday, Previous 7 days, Previous 30 days, Older.
const DAY = 86_400_000;

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupByDate(items, now = Date.now(), key = (item) => item.updatedAt) {
  const today = startOfDay(now);
  const groups = [["Today", []], ["Yesterday", []], ["Previous 7 days", []], ["Previous 30 days", []], ["Older", []]];
  for (const item of items) {
    const at = key(item);
    const index = at >= today ? 0 : at >= today - DAY ? 1 : at >= today - 7 * DAY ? 2 : at >= today - 30 * DAY ? 3 : 4;
    groups[index][1].push(item);
  }
  return groups.filter(([, list]) => list.length);
}
