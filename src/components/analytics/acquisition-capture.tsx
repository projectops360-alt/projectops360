"use client";

import { useEffect } from "react";
import { captureAcquisitionTouch } from "@/lib/analytics/acquisition-client";

export function AcquisitionCapture() {
  useEffect(() => {
    captureAcquisitionTouch();
  }, []);
  return null;
}
