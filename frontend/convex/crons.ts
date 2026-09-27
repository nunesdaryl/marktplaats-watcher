import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Each watch has its own schedule (every 15 min … weekly); this dispatcher runs whichever are due.
crons.interval("check due watches", { minutes: 15 }, internal.checker.checkDue, {});
crons.daily("forget data older than 30 days", { hourUTC: 3, minuteUTC: 0 }, internal.checker.purgeOld, {});
export default crons;
