"use client";

import { useEffect, useRef, useCallback } from "react";
import type { QueuePatientResponse } from "@/types";

export function useQueueStream(
  onUpdate: (patients: QueuePatientResponse[]) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const connect = useCallback(() => {
    const es = new EventSource("/api/queue/stream");

    es.addEventListener("queue_updated", (event) => {
      try {
        const data = JSON.parse(event.data) as {
          patients: QueuePatientResponse[];
        };
        onUpdateRef.current(data.patients);
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
      setTimeout(connect, 3000);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);
}
