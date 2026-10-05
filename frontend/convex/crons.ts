import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Each watch has its own schedule (every 15 min … weekly); this dispatcher runs whichever are due.
crons.interval("check due watches", { minutes: 15 }, internal.checker.checkDue, {});
crons.daily("forget data older than 30 days", { hourUTC: 3, minuteUTC: 0 }, internal.checker.purgeOld, {});
crons.daily("delivery audit", { hourUTC: 4, minuteUTC: 30 }, internal.audit.run, {});
crons.daily("dashboard totals recount", { hourUTC: 4, minuteUTC: 40 }, internal.totals.recount, {});
// 05:00 UTC = 07:00 Amsterdam in summer, 06:00 in winter: before the owner's day starts
crons.daily("owner health digest", { hourUTC: 5, minuteUTC: 0 }, internal.health.digest, {});
crons.daily("founding month reminders", { hourUTC: 6, minuteUTC: 0 }, internal.founding.sendReminders, {});
crons.daily("forget founding answers after 12 months", { hourUTC: 3, minuteUTC: 45 }, internal.founding.purge, {});
crons.daily("forget usage events older than 90 days", { hourUTC: 3, minuteUTC: 30 }, internal.events.purge, {});
crons.interval("OpenAI monthly costs", { hours: 1 }, internal.openaiSpend.refreshCosts, {});
export default crons;
