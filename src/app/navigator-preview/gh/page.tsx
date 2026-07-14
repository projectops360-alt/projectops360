import { notFound } from "next/navigation";
import { GhHarness } from "./harness-client";

// DEV-ONLY GitHub Intelligence visual harness (synthetic data, no DB, no prod).
// Hidden in production builds so it never ships to users. Public via the
// middleware `/navigator-preview/*` allowlist in development.
export default function GhHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GhHarness />;
}
