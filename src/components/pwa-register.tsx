"use client";

import { useEffect } from "react";

/** Register the worker only in production so local development is never served stale. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.warn("NeuBench offline support could not be enabled.", error);
    });
  }, []);

  return null;
}
