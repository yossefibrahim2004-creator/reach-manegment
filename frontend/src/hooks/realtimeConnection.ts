export interface RealtimeConnectionOptions {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<string>;
  onFrame: (frame: string) => void;
  onConnected?: () => void;
  onReconnected?: () => void;
  onPermanentError?: (status: number) => void;
  fetcher?: typeof fetch;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancelScheduled?: (timer: ReturnType<typeof setTimeout>) => void;
  random?: () => number;
}

const MAX_RETRIES = 5;
const MAX_RETRY_DELAY = 30_000;
const HEALTHY_CONNECTION_MS = 30_000;

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function getTransientRefreshFailureStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("isAxiosError" in error)) {
    return undefined;
  }
  if (error.isAxiosError !== true) return undefined;

  if (!("response" in error) || !error.response || typeof error.response !== "object") {
    return 0;
  }
  if (!("status" in error.response) || typeof error.response.status !== "number") {
    return undefined;
  }
  return isTransientStatus(error.response.status) ? error.response.status : undefined;
}

export function startRealtimeConnection({
  getAccessToken,
  refreshSession,
  onFrame,
  onConnected,
  onReconnected,
  onPermanentError,
  fetcher = fetch,
  schedule = setTimeout,
  cancelScheduled = clearTimeout,
  random = Math.random,
}: RealtimeConnectionOptions): () => void {
  let stopped = false;
  let hasConnected = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let healthyTimer: ReturnType<typeof setTimeout> | undefined;
  let activeController: AbortController | undefined;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const reportPermanentError = (status: number) => {
    stopped = true;
    onPermanentError?.(status);
  };

  const scheduleRetry = (status: number) => {
    if (stopped) return;
    if (retryCount >= MAX_RETRIES) {
      reportPermanentError(status);
      return;
    }

    const exponentialDelay = Math.min(1000 * 2 ** retryCount, MAX_RETRY_DELAY);
    const jitteredDelay = Math.round(exponentialDelay * (0.8 + random() * 0.4));
    retryCount += 1;
    retryTimer = schedule(() => {
      retryTimer = undefined;
      void connect();
    }, jitteredDelay);
  };

  const connect = async (refreshRetried = false): Promise<void> => {
    if (stopped) return;
    const token = getAccessToken();
    if (!token) {
      stopped = true;
      return;
    }

    const controller = new AbortController();
    activeController = controller;
    let retryStatus: number | undefined;
    let refreshRequired = false;

    try {
      const response = await fetcher("/api/realtime/events", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (stopped) return;

      if (response.status === 401) {
        if (refreshRetried) {
          reportPermanentError(401);
        } else {
          refreshRequired = true;
        }
      } else if (response.status === 403) {
        reportPermanentError(403);
      } else if (!response.ok) {
        if (isTransientStatus(response.status)) {
          retryStatus = response.status;
        } else {
          reportPermanentError(response.status);
        }
      } else if (!response.body) {
        retryStatus = 503;
      } else {
        if (hasConnected) {
          onReconnected?.();
        } else {
          hasConnected = true;
        }
        onConnected?.();
        healthyTimer = schedule(() => {
          healthyTimer = undefined;
          retryCount = 0;
        }, HEALTHY_CONNECTION_MS);

        const reader = response.body.getReader();
        activeReader = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) {
            retryStatus = 503;
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          frames.forEach(onFrame);
        }
      }
    } catch {
      if (!stopped) retryStatus = 0;
    } finally {
      if (healthyTimer !== undefined) {
        cancelScheduled(healthyTimer);
        healthyTimer = undefined;
      }
      if (activeReader) {
        void activeReader.cancel().catch(() => undefined);
        activeReader = undefined;
      }
      if (activeController === controller) activeController = undefined;
    }

    if (stopped) return;
    if (refreshRequired) {
      try {
        await refreshSession();
      } catch (error) {
        if (stopped) return;
        const transientStatus = getTransientRefreshFailureStatus(error);
        if (transientStatus === undefined) {
          reportPermanentError(401);
        } else {
          scheduleRetry(transientStatus);
        }
        return;
      }
      if (stopped) return;
      void connect(true);
      return;
    }
    if (retryStatus !== undefined) {
      scheduleRetry(retryStatus);
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer !== undefined) cancelScheduled(retryTimer);
    if (healthyTimer !== undefined) cancelScheduled(healthyTimer);
    activeController?.abort();
    if (activeReader) void activeReader.cancel().catch(() => undefined);
  };
}
