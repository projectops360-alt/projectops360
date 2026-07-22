export class RequestBodyError extends Error {
  constructor(
    public readonly code: "invalid_json" | "payload_too_large" | "unsupported_media_type",
    public readonly status: 400 | 413 | 415,
  ) {
    super(code);
  }
}

function assertContentLength(request: Request, maxBytes: number): void {
  const raw = request.headers.get("content-length");
  if (!raw) return;
  const contentLength = Number(raw);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new RequestBodyError("payload_too_large", 413);
  }
  if (contentLength > maxBytes) throw new RequestBodyError("payload_too_large", 413);
}

function assertJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new RequestBodyError("unsupported_media_type", 415);
  }
}

export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  assertContentLength(request, maxBytes);
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("payload_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  assertJsonContentType(request);
  const rawBody = await readLimitedText(request, maxBytes);
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestBodyError("invalid_json", 400);
  }
}
