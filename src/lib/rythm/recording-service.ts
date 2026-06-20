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

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

/**
 * Lists available audio input devices. Device labels are only exposed by the
 * browser after a microphone permission grant, so when `unlock` is true we open
 * a throwaway stream first to reveal real labels. Without it, labels may be
 * blank (we fall back to "Microphone N").
 */
export async function listAudioInputDevices(unlock = false): Promise<AudioInputDevice[]> {
  if (!isRecordingSupported()) return [];
  let temp: MediaStream | null = null;
  if (unlock) {
    try {
      temp = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      /* permission denied — enumerate anyway (labels will be blank) */
    }
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  temp?.getTracks().forEach((t) => t.stop());
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
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
  // Web Audio nodes used only to expose a live input level (mic meter).
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null;
  state: RecorderState = "idle";

  getMimeType(): string {
    return this.mimeType || "audio/webm";
  }

  async start(deviceId?: string): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error("recording_unsupported");
    }
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (deviceId) audioConstraints.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    this.mimeType = pickSupportedMimeType();
    this.chunks = [];

    const options: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
    if (this.mimeType) options.mimeType = this.mimeType;
    this.mediaRecorder = new MediaRecorder(this.stream, options);

    // Capture the actual negotiated type (browser may override our preference).
    this.mimeType = this.mediaRecorder.mimeType || this.mimeType || "audio/webm";

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };

    this.setupLevelMeter(this.stream);

    this.mediaRecorder.start(1000); // gather data every second
    this.state = "recording";
  }

  /** 0..1 instantaneous input level (RMS). 0 ⇒ no signal reaching the mic. */
  getLevel(): number {
    if (!this.analyser || !this.levelBuffer) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuffer);
    let sumSquares = 0;
    for (let i = 0; i < this.levelBuffer.length; i++) {
      const deviation = (this.levelBuffer[i] - 128) / 128; // -1..1
      sumSquares += deviation * deviation;
    }
    const rms = Math.sqrt(sumSquares / this.levelBuffer.length);
    return Math.min(1, rms * 3); // scale up so normal speech fills the bar
  }

  private setupLevelMeter(stream: MediaStream): void {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new Ctx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.levelBuffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      source.connect(this.analyser); // analyser NOT connected to destination (no echo)
    } catch {
      this.analyser = null; // metering is best-effort; never block recording
    }
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
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.levelBuffer = null;
  }
}
