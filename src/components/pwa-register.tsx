"use client";

import { useEffect } from "react";

/** Register the worker and purge any stale legacy shells */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Purge legacy shell v1 cache immediately from client
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key === "neubench-shell-v1") {
            console.log("[PwaRegister] Deleting obsolete v1 cache:", key);
            caches.delete(key);
          }
        }
      }).catch(() => {});
    }

    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Check for updates to sw.js
        reg.update().catch(() => {});
      })
      .catch((error: unknown) => {
        console.warn("NeuBench offline support could not be enabled.", error);
      });
  }, []);

  return null;
}
