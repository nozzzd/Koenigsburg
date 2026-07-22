"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Keeps an already-open portal honest when Discord membership changes. The
 * server performs the real authorization check; this component only polls the
 * small status endpoint and moves a revoked member out of the citizen portal.
 */
export function CitizenshipWatcher() {
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;

    const check = async () => {
      if (document.visibilityState !== "visible") return;

      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/auth/citizenship", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (stopped) return;
        if (response.status === 401) {
          window.location.replace("/login");
        } else if (response.status === 403) {
          window.location.replace("/pending?revoked=1");
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          // A transient connection failure must not eject an otherwise valid
          // citizen. The next interval retries quietly.
        }
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return null;
}
