import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ISABELLA_SCREEN_CONTEXT_EVENT,
  publishIsabellaScreenContext,
  readIsabellaScreenContext,
} from "@/lib/isabella/screen-context-event";

describe("Isabella screen context event", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retains the latest context for subscribers mounted after publication", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    vi.stubGlobal("CustomEvent", class<T> extends Event {
      detail: T;

      constructor(type: string, init: CustomEventInit<T>) {
        super(type);
        this.detail = init.detail as T;
      }
    });

    const received: unknown[] = [];
    target.addEventListener(ISABELLA_SCREEN_CONTEXT_EVENT, (event) => {
      received.push(
        (event as CustomEvent<{ context: unknown }>).detail.context,
      );
    });

    const context = {
      module: "process_mining",
      screen: "process_intelligence_canvas",
    };
    publishIsabellaScreenContext(context);

    expect(received).toEqual([context]);
    expect(readIsabellaScreenContext()).toEqual(context);
  });

  it("clears retained context when the publishing screen unmounts", () => {
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("CustomEvent", class<T> extends Event {
      detail: T;

      constructor(type: string, init: CustomEventInit<T>) {
        super(type);
        this.detail = init.detail as T;
      }
    });

    publishIsabellaScreenContext({ module: "process_mining" });
    publishIsabellaScreenContext(null);

    expect(readIsabellaScreenContext()).toBeNull();
  });
});
