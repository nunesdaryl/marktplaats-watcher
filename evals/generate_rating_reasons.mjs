import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REASONS } from "../frontend/src/lib/ratings.js";

writeFileSync(fileURLToPath(new URL("data/rating_reasons.json", import.meta.url)),
  `${JSON.stringify(Object.fromEntries(REASONS), null, 2)}\n`);
