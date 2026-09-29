import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Each watch has its own schedule (every 15 min … weekly); this dispatcher runs whichever are due.
crons.interval("check due watches", { minutes: 15 }, internal.checker.checkDue, {});
crons.daily("forget data older than 30 days", { hourUTC: 3, minuteUTC: 0 }, internal.checker.purgeOld, {});
// 05:00 UTC = 07:00 Amsterdam in summer, 06:00 in winter: before the owner's day starts
crons.daily("owner health digest", { hourUTC: 5, minuteUTC: 0 }, internal.health.digest, {});
crons.daily("forget usage events older than 90 days", { hourUTC: 3, minuteUTC: 30 }, internal.events.purge, {});
export default crons;
