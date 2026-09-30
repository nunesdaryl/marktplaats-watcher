# 0009: Filtered, date-sorted search for checks

## Context
The public `/q/` page ignored sorting and filters and showed only 30 listings. Fixed page counts also missed new ads, and sorting within a day is not reliable. [Design §16](../system-design.html).

## Decision
Scheduled checks read Marktplaats `/lrp/api/search` with the watch's filters, page through whole days since the last successful check, and use the newest listing from that check as a watermark. The operator accepted the robots.txt and terms risk for the demo.

## Alternatives
The public `/q/` page missed results; fixed page counts missed new ads; the official API requires partner credentials; the assessed hosted scraper retained the terms risk at additional cost.

## Trade-offs
The route is disallowed by robots.txt and repeated systematic querying conflicts with the recorded terms. Reads stop at 40 pages and log `coverage_capped` if reached.

## Consequences
Duplicate searches share a read. MW-14, an application for official API access, is the exit from this accepted risk. [README limits](../../README.md).

## Status
Accepted

## Date
2026-09-29
