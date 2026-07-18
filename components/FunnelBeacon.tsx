"use client";

import { useEffect, useRef } from "react";
import { track } from "@/actions/funnel";
import type { FunnelEventName } from "@/lib/supabase";

/**
 * Fires one funnel event when the page mounts, exactly once (a StrictMode
 * double-mount in dev is guarded). Renders nothing. Best-effort — track()
 * swallows its own errors.
 */
export function FunnelBeacon({ event }: { event: FunnelEventName }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void track(event);
  }, [event]);
  return null;
}
