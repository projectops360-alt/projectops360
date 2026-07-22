import { describe, expect, it } from "vitest";
import { readLimitedJson, readLimitedText } from "../request-body";

describe("bounded request bodies", () => {
  it("parses JSON within the byte limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readLimitedJson(request, 64)).resolves.toEqual({ ok: true });
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await expect(readLimitedJson(request, 64)).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
    });
  });

  it("rejects an oversized declared body", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "1000" },
      body: "small",
    });
    await expect(readLimitedText(request, 32)).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
    });
  });

  it("enforces the actual streamed byte count without content-length", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("a".repeat(40)));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readLimitedText(request, 32)).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
    });
  });
});
