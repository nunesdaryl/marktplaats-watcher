# MW-99 simulated dashboard long run

Date: 2026-10-07. The harness mounts the real `Overview` and `Runs` React components in jsdom with mocked Convex responses, then advances the clock and rerenders once per minute for 60 minutes. It records Node heap, DOM nodes, event listeners, intervals, and distinct and active mock Convex query subscriptions at every minute. The fixture contains one chart day and empty result lists, so its DOM size is smaller than production.

Command: `cd frontend && MW99_PROFILE=1 node --expose-gc node_modules/vitest/vitest.mjs run src/views/admin/longRun.test.jsx --reporter verbose`

Before the fix, the same 60-minute `Runs` drilldown generated **61 distinct query argument sets** (one per minute); the regression assertion failed. The rolling `dateFilters(params)` call used `Date.now()` on every render. `Workspace` rerenders every minute for its founding countdown. Convex serializes arguments to decide whether to subscribe, so each changing `since` value changes the subscription key. The mock counts one active subscription per query after cleanup; the distinct-key count shows the churn.

After the fix, the open overview plus drilldown has **6 active mock query subscriptions and 6 distinct argument sets** throughout the run; `Runs` itself has one distinct argument set. DOM nodes, listener registrations, and intervals are constant. Heap changes from 67.57 MiB at minute 0 to 56.80 MiB at minute 60 (-15.9%). The Vitest worker did not expose `global.gc`, so interim heap samples include ordinary garbage collection swings. This simulated run does not measure a real browser or live Convex memory.

| Minute | Heap MiB | DOM nodes | Listeners | Intervals | Distinct queries | Active queries |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 67.57 | 292 | 153 | 0 | 6 | 6 |
| 1 | 69.35 | 292 | 153 | 0 | 6 | 6 |
| 2 | 70.42 | 292 | 153 | 0 | 6 | 6 |
| 3 | 71.49 | 292 | 153 | 0 | 6 | 6 |
| 4 | 72.52 | 292 | 153 | 0 | 6 | 6 |
| 5 | 73.58 | 292 | 153 | 0 | 6 | 6 |
| 6 | 74.62 | 292 | 153 | 0 | 6 | 6 |
| 7 | 75.69 | 292 | 153 | 0 | 6 | 6 |
| 8 | 76.74 | 292 | 153 | 0 | 6 | 6 |
| 9 | 69.39 | 292 | 153 | 0 | 6 | 6 |
| 10 | 70.34 | 292 | 153 | 0 | 6 | 6 |
| 11 | 71.28 | 292 | 153 | 0 | 6 | 6 |
| 12 | 54.02 | 292 | 153 | 0 | 6 | 6 |
| 13 | 54.91 | 292 | 153 | 0 | 6 | 6 |
| 14 | 55.80 | 292 | 153 | 0 | 6 | 6 |
| 15 | 56.68 | 292 | 153 | 0 | 6 | 6 |
| 16 | 57.59 | 292 | 153 | 0 | 6 | 6 |
| 17 | 58.50 | 292 | 153 | 0 | 6 | 6 |
| 18 | 59.41 | 292 | 153 | 0 | 6 | 6 |
| 19 | 60.31 | 292 | 153 | 0 | 6 | 6 |
| 20 | 61.22 | 292 | 153 | 0 | 6 | 6 |
| 21 | 62.13 | 292 | 153 | 0 | 6 | 6 |
| 22 | 63.05 | 292 | 153 | 0 | 6 | 6 |
| 23 | 63.98 | 292 | 153 | 0 | 6 | 6 |
| 24 | 64.90 | 292 | 153 | 0 | 6 | 6 |
| 25 | 65.84 | 292 | 153 | 0 | 6 | 6 |
| 26 | 54.62 | 292 | 153 | 0 | 6 | 6 |
| 27 | 55.59 | 292 | 153 | 0 | 6 | 6 |
| 28 | 56.54 | 292 | 153 | 0 | 6 | 6 |
| 29 | 57.45 | 292 | 153 | 0 | 6 | 6 |
| 30 | 58.16 | 292 | 153 | 0 | 6 | 6 |
| 31 | 58.87 | 292 | 153 | 0 | 6 | 6 |
| 32 | 59.58 | 292 | 153 | 0 | 6 | 6 |
| 33 | 60.30 | 292 | 153 | 0 | 6 | 6 |
| 34 | 61.05 | 292 | 153 | 0 | 6 | 6 |
| 35 | 61.77 | 292 | 153 | 0 | 6 | 6 |
| 36 | 62.50 | 292 | 153 | 0 | 6 | 6 |
| 37 | 63.25 | 292 | 153 | 0 | 6 | 6 |
| 38 | 63.99 | 292 | 153 | 0 | 6 | 6 |
| 39 | 64.73 | 292 | 153 | 0 | 6 | 6 |
| 40 | 65.47 | 292 | 153 | 0 | 6 | 6 |
| 41 | 66.22 | 292 | 153 | 0 | 6 | 6 |
| 42 | 54.70 | 292 | 153 | 0 | 6 | 6 |
| 43 | 55.46 | 292 | 153 | 0 | 6 | 6 |
| 44 | 56.22 | 292 | 153 | 0 | 6 | 6 |
| 45 | 56.99 | 292 | 153 | 0 | 6 | 6 |
| 46 | 57.77 | 292 | 153 | 0 | 6 | 6 |
| 47 | 58.54 | 292 | 153 | 0 | 6 | 6 |
| 48 | 59.32 | 292 | 153 | 0 | 6 | 6 |
| 49 | 60.10 | 292 | 153 | 0 | 6 | 6 |
| 50 | 60.89 | 292 | 153 | 0 | 6 | 6 |
| 51 | 61.69 | 292 | 153 | 0 | 6 | 6 |
| 52 | 62.48 | 292 | 153 | 0 | 6 | 6 |
| 53 | 63.28 | 292 | 153 | 0 | 6 | 6 |
| 54 | 64.09 | 292 | 153 | 0 | 6 | 6 |
| 55 | 64.91 | 292 | 153 | 0 | 6 | 6 |
| 56 | 65.73 | 292 | 153 | 0 | 6 | 6 |
| 57 | 66.54 | 292 | 153 | 0 | 6 | 6 |
| 58 | 55.13 | 292 | 153 | 0 | 6 | 6 |
| 59 | 55.97 | 292 | 153 | 0 | 6 | 6 |
| 60 | 56.80 | 292 | 153 | 0 | 6 | 6 |

The regression test also changes the period to 30 days and checks that the Today range updates when Amsterdam reaches midnight. Existing overview tests cover the displayed figures and refresh behavior.
