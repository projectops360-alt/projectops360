// ============================================================================
// ProjectOps360° — MPF Engine · Blocker Detector (Phase 3, Task 5)
// ============================================================================
// Blocker detection is implemented alongside the other delay detectors in
// delay-detector.ts so it shares the same finding builder, status/severity/
// confidence primitives, and Task 4 metric-duration reads (single source of
// truth, no import cycle). This module re-exports the blocker entry point for
// discoverability.
//
// A blocker finding is derived from a Task 3 `blocked` segment: OPEN when the
// segment is open-ended, RESOLVED when the unblocking event closed it. Duration
// is READ from Task 4 metrics (never recomputed). It is NOT a bottleneck — final
// bottleneck classification is a later task.
// ============================================================================

export { detectBlockerFindings } from "./delay-detector";
export type { SegmentForDetection } from "./delay-detector";
