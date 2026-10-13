import assert from "node:assert/strict";
import { test } from "node:test";
import { startRealtimeConnection } from "./realtimeConnection.ts";
import {
  expireSessionOnce,
  resetSessionExpiryForTests,
} from "../lib/sessionExpiry.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function openResponse() {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: update\ndata: {}\n\n"));
      },
    }),
  );
}

test("sends the stored bearer token and stops the stream on cleanup", async () => {
  let requestSignal: AbortSignal | undefined;
  let receivedFrame = false;
  const stop = startRealtimeConnection({
    getAccessToken: () => "valid-token",
    refreshSession: async () => "refreshed-token",
    onFrame: (frame) => {
      receivedFrame = frame.includes("event: update");
    },
    fetcher: async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer valid-token");
      requestSignal = init?.signal as AbortSignal;
      return openResponse();
    },
  });

  await flush();
  assert.equal(receivedFrame, true);
  assert.equal(requestSignal?.aborted, false);
  stop();
  assert.equal(requestSignal?.aborted, true);
});

test("does not issue a request without an authenticated session", async () => {
  let requests = 0;
  startRealtimeConnection({
    getAccessToken: () => null,
    refreshSession: async () => "unused",
    onFrame: () => undefined,
    fetcher: async () => {
      requests += 1;
      return new Response(null);
    },
  });
  await flush();
  assert.equal(requests, 0);
});

test("refreshes an expired token through the session flow and reconnects once", async () => {
  let token = "expired-token";
  let requests = 0;
  const stop = startRealtimeConnection({
    getAccessToken: () => token,
    refreshSession: async () => {
      token = "fresh-token";
      return token;
    },
    onFrame: () => undefined,
    fetcher: async (_input, init) => {
      requests += 1;
      if (requests === 1) {
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer expired-token");
        return new Response(null, { status: 401 });
      }
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh-token");
      return openResponse();
    },
  });

  await flush();
  await flush();
  assert.equal(requests, 2);
  stop();
});

test("stops after refresh failure and does not retry a forbidden response", async () => {
  let expiredRequests = 0;
  let expiredStatus: number | undefined;
  startRealtimeConnection({
    getAccessToken: () => "expired-token",
    refreshSession: async () => {
      throw new Error("session expired");
    },
    onFrame: () => undefined,
    onPermanentError: (status) => {
      expiredStatus = status;
    },
    fetcher: async () => {
      expiredRequests += 1;
      return new Response(null, { status: 401 });
    },
  });
  await flush();
  await flush();
  assert.equal(expiredRequests, 1);
  assert.equal(expiredStatus, 401);

  let forbiddenRequests = 0;
  let forbiddenStatus: number | undefined;
  startRealtimeConnection({
    getAccessToken: () => "valid-token",
    refreshSession: async () => "unused",
    onFrame: () => undefined,
    onPermanentError: (status) => {
      forbiddenStatus = status;
    },
    fetcher: async () => {
      forbiddenRequests += 1;
      return new Response(null, { status: 403 });
    },
  });
  await flush();
  assert.equal(forbiddenRequests, 1);
  assert.equal(forbiddenStatus, 403);
});

test("does not reconnect after the refreshed access token is rejected", async () => {
  let requests = 0;
  let permanentStatus: number | undefined;
  const stop = startRealtimeConnection({
    getAccessToken: () => "fresh-token",
    refreshSession: async () => "fresh-token",
    onFrame: () => undefined,
    onPermanentError: (status) => {
      permanentStatus = status;
    },
    fetcher: async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    },
  });

  await flush();
  await flush();
  await flush();
  assert.equal(requests, 2);
  assert.equal(permanentStatus, 401);
  stop();
});

test("refresh failure uses one idempotent session redirect", async () => {
  resetSessionExpiryForTests();
  let redirects = 0;
  const redirect = () => {
    redirects += 1;
  };
  const stop = startRealtimeConnection({
    getAccessToken: () => "expired-token",
    refreshSession: async () => {
      expireSessionOnce(redirect);
      throw new Error("refresh rejected");
    },
    onFrame: () => undefined,
    onPermanentError: (status) => {
      if (status === 401) expireSessionOnce(redirect);
    },
    fetcher: async () => new Response(null, { status: 401 }),
  });

  try {
    await flush();
    await flush();
    assert.equal(redirects, 1);
  } finally {
    stop();
    resetSessionExpiryForTests();
  }
});

test("refreshed token rejected by SSE uses one idempotent session redirect", async () => {
  resetSessionExpiryForTests();
  let redirects = 0;
  let requests = 0;
  const redirect = () => {
    redirects += 1;
  };
  const stop = startRealtimeConnection({
    getAccessToken: () => "fresh-token",
    refreshSession: async () => "fresh-token",
    onFrame: () => undefined,
    onPermanentError: (status) => {
      if (status === 401) expireSessionOnce(redirect);
    },
    fetcher: async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    },
  });

  try {
    await flush();
    await flush();
    await flush();
    assert.equal(requests, 2);
    assert.equal(redirects, 1);
  } finally {
    stop();
    resetSessionExpiryForTests();
  }
});

test("uses bounded retry handling for transient refresh failures", async () => {
  let permanentStatus: number | undefined;
  let scheduledDelay: number | undefined;
  const stop = startRealtimeConnection({
    getAccessToken: () => "expired-token",
    refreshSession: async () => {
      throw { isAxiosError: true, response: { status: 503 } };
    },
    onFrame: () => undefined,
    onPermanentError: (status) => {
      permanentStatus = status;
    },
    fetcher: async () => new Response(null, { status: 401 }),
    schedule: (callback, delay) => {
      scheduledDelay = delay;
      const timer = setTimeout(callback, 60_000);
      timer.unref();
      return timer;
    },
    cancelScheduled: clearTimeout,
    random: () => 0.5,
  });

  await flush();
  await flush();
  assert.equal(scheduledDelay, 1000);
  assert.equal(permanentStatus, undefined);
  stop();
});

test("ignores refresh results after the connection has been stopped", async () => {
  let rejectRefresh: ((error: Error) => void) | undefined;
  let permanentStatus: number | undefined;
  const stop = startRealtimeConnection({
    getAccessToken: () => "expired-token",
    refreshSession: () =>
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    onFrame: () => undefined,
    onPermanentError: (status) => {
      permanentStatus = status;
    },
    fetcher: async () => new Response(null, { status: 401 }),
  });

  await flush();
  stop();
  rejectRefresh?.(new Error("stale refresh"));
  await flush();
  assert.equal(permanentStatus, undefined);
});

test("bounds transient retries and increases the retry delay", async () => {
  let requests = 0;
  let permanentStatus: number | undefined;
  const scheduled: Array<{
    callback: () => void;
    delay: number;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  const delays: number[] = [];
  const stop = startRealtimeConnection({
    getAccessToken: () => "valid-token",
    refreshSession: async () => "unused",
    onFrame: () => undefined,
    onPermanentError: (status) => {
      permanentStatus = status;
    },
    fetcher: async () => {
      requests += 1;
      return new Response(null, { status: 503 });
    },
    schedule: (callback, delay) => {
      const timer = setTimeout(() => undefined, 60_000);
      scheduled.push({ callback, delay, timer });
      delays.push(delay);
      return timer;
    },
    cancelScheduled: clearTimeout,
    random: () => 0.5,
  });

  await flush();
  while (scheduled.length) {
    const next = scheduled.shift();
    assert.ok(next);
    clearTimeout(next.timer);
    next.callback();
    await flush();
  }

  assert.equal(requests, 6);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000]);
  assert.equal(permanentStatus, 503);
  stop();
});

test("does not reconnect after unmount aborts an active request", async () => {
  let requests = 0;
  let aborted = false;
  const scheduled: Array<ReturnType<typeof setTimeout>> = [];
  const stop = startRealtimeConnection({
    getAccessToken: () => "valid-token",
    refreshSession: async () => "unused",
    onFrame: () => undefined,
    fetcher: (_input, init) =>
      new Promise((_resolve, reject) => {
        requests += 1;
        init?.signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      }),
    schedule: (callback, delay) => {
      const timer = setTimeout(callback, delay);
      scheduled.push(timer);
      return timer;
    },
    cancelScheduled: clearTimeout,
  });

  await flush();
  stop();
  await flush();
  assert.equal(aborted, true);
  assert.equal(requests, 1);
  assert.equal(scheduled.length, 0);
});

test("invalidates once after a reconnect but not on the initial connection", async () => {
  let requests = 0;
  let reconnectInvalidations = 0;
  let failFirstStream: (() => void) | undefined;
  const retries: Array<{
    callback: () => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const stop = startRealtimeConnection({
    getAccessToken: () => "valid-token",
    refreshSession: async () => "unused",
    onFrame: () => undefined,
    onReconnected: () => {
      reconnectInvalidations += 1;
    },
    fetcher: async () => {
      requests += 1;
      if (requests === 1) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("event: ready\ndata: {}\n\n"));
              failFirstStream = () => controller.error(new Error("connection lost"));
            },
          }),
        );
      }
      if (requests === 2) return new Response(null, { status: 503 });
      return openResponse();
    },
    schedule: (callback, delay) => {
      const timer = setTimeout(() => undefined, delay);
      timer.unref();
      timers.push(timer);
      if (delay < 30_000) retries.push({ callback, timer });
      return timer;
    },
    cancelScheduled: clearTimeout,
    random: () => 0.5,
  });

  try {
    await flush();
    assert.equal(requests, 1);
    assert.equal(reconnectInvalidations, 0);

    failFirstStream?.();
    await flush();
    const firstRetry = retries.shift();
    assert.ok(firstRetry);
    clearTimeout(firstRetry.timer);
    firstRetry.callback();
    await flush();
    assert.equal(requests, 2);
    assert.equal(reconnectInvalidations, 0);

    const secondRetry = retries.shift();
    assert.ok(secondRetry);
    clearTimeout(secondRetry.timer);
    secondRetry.callback();
    await flush();
    assert.equal(requests, 3);
    assert.equal(reconnectInvalidations, 1);
  } finally {
    stop();
    timers.forEach(clearTimeout);
  }
});
