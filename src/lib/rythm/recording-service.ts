// ============================================================================
// rythmRecordingService — thin wrapper around the MediaRecorder API
// ============================================================================
// Browser-only. Handles getUserMedia + MediaRecorder lifecycle and returns the
// captured audio as a Blob. Timer / UI state is owned by the component.
// ============================================================================

/** Preferred → fallback recording MIME types. First supported one wins. */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/wav",
];

export function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return ""; // let the browser choose its default
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
}

/**
 * Stateful recorder. Typical use:
 *   const rec = new RythmRecorder();
 *   await rec.start();
 *   rec.pause(); rec.resume();
 *   const { blob, mimeType } = await rec.stop();
 *   rec.dispose();
 */
export class RythmRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  state: RecorderState = "idle";

  getMimeType(): string {
    return this.mimeType || "audio/webm";
  }

  async start(): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error("recording_unsupported");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = pickSupportedMimeType();
    this.chunks = [];

    this.mediaRecorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);

    // Capture the actual negotiated type (browser may override our preference).
    this.mimeType = this.mediaRecorder.mimeType || this.mimeType || "audio/webm";

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };

    this.mediaRecorder.start(1000); // gather data every second
    this.state = "recording";
  }

  pause(): void {
    if (this.mediaRecorder && this.state === "recording") {
      this.mediaRecorder.pause();
      this.state = "paused";
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.state === "paused") {
      this.mediaRecorder.resume();
      this.state = "recording";
    }
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("not_recording"));
        return;
      }
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.getMimeType() });
        this.state = "stopped";
        this.stopStream();
        resolve({ blob, mimeType: this.getMimeType() });
      };
      recorder.stop();
    });
  }

  /** Release the microphone without producing a blob (cancel). */
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.stopStream();
    this.mediaRecorder = null;
    this.chunks = [];
    this.state = "idle";
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
