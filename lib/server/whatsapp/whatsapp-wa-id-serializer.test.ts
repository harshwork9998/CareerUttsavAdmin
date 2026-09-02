import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getWaIdSerializerActiveCountForTests,
  resetWaIdSerializerForTests,
  runSerializedForWaId,
} from "@/lib/server/whatsapp/whatsapp-wa-id-serializer";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("whatsapp waId serializer", () => {
  afterEach(() => {
    resetWaIdSerializerForTests();
  });

  it("executes same-waId tasks sequentially", async () => {
    const order: string[] = [];

    const first = runSerializedForWaId("919876543210", async () => {
      order.push("a-start");
      await delay(30);
      order.push("a-end");
      return "a";
    });
    const second = runSerializedForWaId("919876543210", async () => {
      order.push("b-start");
      order.push("b-end");
      return "b";
    });

    await Promise.all([first, second]);

    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  it("does not start the second same-waId task before the first finishes", async () => {
    let secondStarted = false;

    const first = runSerializedForWaId("919876543210", async () => {
      await delay(40);
      expect(secondStarted).toBe(false);
      return 1;
    });
    const second = runSerializedForWaId("919876543210", async () => {
      secondStarted = true;
      return 2;
    });

    await Promise.all([first, second]);
    expect(secondStarted).toBe(true);
  });

  it("preserves same-waId result ordering", async () => {
    const results = await Promise.all([
      runSerializedForWaId("919876543210", async () => {
        await delay(20);
        return "first";
      }),
      runSerializedForWaId("919876543210", async () => "second"),
      runSerializedForWaId("919876543210", async () => "third"),
    ]);

    expect(results).toEqual(["first", "second", "third"]);
  });

  it("allows different waIds to execute concurrently", async () => {
    const order: string[] = [];

    await Promise.all([
      runSerializedForWaId("919111111111", async () => {
        order.push("user-a-start");
        await delay(40);
        order.push("user-a-end");
      }),
      runSerializedForWaId("919222222222", async () => {
        order.push("user-b-start");
        await delay(5);
        order.push("user-b-end");
      }),
    ]);

    expect(order.indexOf("user-b-end")).toBeLessThan(order.indexOf("user-a-end"));
  });

  it("continues the queue after the first task throws", async () => {
    const order: string[] = [];

    await expect(
      runSerializedForWaId("919876543210", async () => {
        order.push("fail");
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    await runSerializedForWaId("919876543210", async () => {
      order.push("after-failure");
    });

    expect(order).toEqual(["fail", "after-failure"]);
  });

  it("propagates fn errors to the caller", async () => {
    await expect(
      runSerializedForWaId("919876543210", async () => {
        throw new Error("processor failed");
      })
    ).rejects.toThrow("processor failed");
  });

  it("cleans up map entries after the final queued task completes", async () => {
    await runSerializedForWaId("919876543210", async () => {
      await delay(10);
    });
    expect(getWaIdSerializerActiveCountForTests()).toBe(0);

    await Promise.all([
      runSerializedForWaId("919876543210", async () => {
        await delay(15);
      }),
      runSerializedForWaId("919876543210", async () => "done"),
    ]);
    expect(getWaIdSerializerActiveCountForTests()).toBe(0);
  });

  it("does not block unrelated waIds", async () => {
    const blocked: string[] = [];

    await Promise.all([
      runSerializedForWaId("919876543210", async () => {
        await delay(50);
        blocked.push("slow-user");
      }),
      runSerializedForWaId("919999999999", async () => {
        blocked.push("other-user");
      }),
    ]);

    expect(blocked).toEqual(["other-user", "slow-user"]);
  });
});
