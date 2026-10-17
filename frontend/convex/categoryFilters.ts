import { ConvexError } from "convex/values";
import data from "./categories.json";

type Facet = { label: string; type: string; values?: Record<string, string>; min?: number; max?: number; unit?: string };
type Category = { id: number; name: string; l1Id: number | null; filters?: Record<string, Facet> };
const categories = new Map<number, Category>((data.categories as Category[]).map((category) => [category.id, category]));

export function categoryName(id?: number) {
  return id === undefined ? undefined : categories.get(id)?.name;
}

export function filterLabels(id?: number, filters?: Record<string, string>) {
  const category = id === undefined ? undefined : categories.get(id);
  return Object.entries(filters ?? {}).map(([key, value]) => {
    const facet = category?.filters?.[key];
    if (!facet) return null;
    if (facet.type === "choice") return facet.values?.[value] ? `${facet.label}: ${facet.values[value]}` : null;
    const match = /^(\d*):(\d*)$/.exec(value);
    if (!match) return null;
    const [min, max] = match.slice(1).map((part) => part && Number(part).toLocaleString("nl-NL"));
    return `${facet.label}: ${min || "0"}–${max || "any"} ${facet.unit ?? ""}`.trim();
  }).filter((label): label is string => !!label);
}

export function normalizeCategory(id?: number, filters?: Record<string, string>, strict = false) {
  if (id === undefined) {
    if (strict && filters && Object.keys(filters).length) throw new ConvexError("Choose a category for its filters.");
    return { categoryId: undefined, attributeFilters: undefined, note: undefined };
  }
  const category = categories.get(id);
  if (!category) {
    if (strict) throw new ConvexError("Choose an available category.");
    return { categoryId: undefined, attributeFilters: undefined, note: "Category is no longer available; its filters were removed." };
  }
  const valid: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(filters ?? {})) {
    const facet = category.filters?.[key];
    const range = /^(\d*):(\d*)$/.exec(value);
    const low = range?.[1] ? Number(range[1]) : undefined;
    const high = range?.[2] ? Number(range[2]) : undefined;
    if (facet?.type === "choice" && facet.values?.[value]) valid[key] = value;
    else if (facet?.type === "range" && range && value !== ":" &&
      (low === undefined || low >= (facet.min ?? 0)) && (high === undefined || high <= (facet.max ?? Infinity)) &&
      (low === undefined || high === undefined || low <= high)) valid[key] = value;
    else dropped.push(key);
  }
  if (strict && dropped.length) throw new ConvexError(`Unknown category filter: ${dropped.join(", ")}.`);
  return { categoryId: id, attributeFilters: Object.keys(valid).length ? valid : undefined,
    note: dropped.length ? `Unavailable category filters were removed: ${dropped.join(", ")}.` : undefined };
}
