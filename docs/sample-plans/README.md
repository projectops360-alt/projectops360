# Sample Plans — test fixtures for Drawing Intelligence / Budget module

Real architectural drawing PDFs to exercise the import + takeoff/budget pipeline.

## Included samples

| File | What it is | Pages | Good for testing |
|------|-----------|-------|------------------|
| `bently-reserve-1st-floor.pdf` | Bently Reserve (San Francisco) — 1st floor banking hall plan | 1 | PDF parse, room/area extraction, dimensions |
| `baldwin-spencer-floor-plan.pdf` | Baldwin Spencer Building, University of Melbourne — floor plan | — | PDF parse, vector/text extraction |

**Source:** Wikimedia Commons (publicly licensed — public domain / CC). These are *floor plans of real buildings*, downloaded 2026-06-13:
- https://commons.wikimedia.org/wiki/File:1st_Floor_Bently_Reserve_Banking_Hall_and_First_Floor.pdf
- https://commons.wikimedia.org/wiki/File:Baldwin_Spencer_Building_(Melbourne_University)_Floor_Plan.pdf

## Limitation (read before using for budget validation)

These are **floor plans only** — they have geometry/dimensions but **not full material schedules or bid quantities**. They're ideal to validate the *mechanics* (upload → parse → extract rooms/areas/dimensions), but NOT to validate quantity takeoff accuracy.

For the **budget module**, add a richer set with schedules/quantities. This sandbox's DNS allowlist blocked direct download of these, but they download fine in a normal browser — drop the PDF here:

- **ROST Architects – Sample Plan Set** (door/window/material schedules): https://www.rostarchitects.com/sample-plan-set
- **HousePlans.pro – Plan D-577** (full CD: foundation, framing, schedules): https://www.houseplans.pro/plans/plan/bid
- **Public agency bid documents** (richest — include a quantified bid schedule): search `"[state] DOT bid letting plans pdf"` or a school-district / city e-procurement portal.

> ⚠️ Many free residential "house plans" are *Not for Construction* bid sets — fine for software testing, not for actual construction. Public bid documents are public domain.

## How to use
1. Open a project → **Drawing Intelligence** tab (or `/import`) and upload a PDF here.
2. Run extraction and inspect the takeoff/insights output.
3. For budget validation, compare extracted quantities against a set that includes a bid schedule.
