import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import {
  expireSessionAndRedirect,
  getStoredAccessToken,
  refreshRealtimeSession,
} from "../lib/api";
import { startRealtimeConnection } from "./realtimeConnection";

export interface RealtimeEvent {
  type: string;
  entity?: string;
  entityId?: number;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

const REALTIME_EVENT = "pos:realtime";

export function useRealtimeEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !user?.accessToken) return;

    const publish = (event: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["stock-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      window.dispatchEvent(new CustomEvent<RealtimeEvent>(REALTIME_EVENT, { detail: event }));
    };

    const parseFrame = (frame: string) => {
      let eventType = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (eventType === "ready" || !data) return;
      try {
        publish(JSON.parse(data) as RealtimeEvent);
      } catch {
        // Ignore malformed frames; the next successful frame remains authoritative.
      }
    };

    const stop = startRealtimeConnection({
      getAccessToken: getStoredAccessToken,
      refreshSession: refreshRealtimeSession,
      onFrame: parseFrame,
      onReconnected: () => void queryClient.invalidateQueries(),
      onConnected: () => window.dispatchEvent(new CustomEvent("pos:realtime-reconnected")),
      onPermanentError: (status) => {
        window.dispatchEvent(
          new CustomEvent("pos:realtime-connection-error", { detail: { status } }),
        );
        if (status === 401) expireSessionAndRedirect();
      },
    });

    return stop;
  }, [userId, user?.accessToken, queryClient]);
}

export function useRealtimeRefresh(
  callback: () => void,
  eventTypes?: readonly string[],
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    const listener = (event: Event) => {
      const realtimeEvent = (event as CustomEvent<RealtimeEvent>).detail;
      if (!eventTypes || eventTypes.includes(realtimeEvent.type)) {
        callbackRef.current();
      }
    };
    window.addEventListener(REALTIME_EVENT, listener);
    return () => window.removeEventListener(REALTIME_EVENT, listener);
  }, [eventTypes]);
}
