"use client";

import { useEffect } from "react";
import { SiteHeader } from "./site-header";

/**
 * Route-segment error boundary. Catches rendering/data errors in the tree below
 * the root layout and gives the reader a way to retry instead of a blank page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unexpected error while rendering the timeline:", error);
  }, [error]);

  return (
    <main className="site-frame archive-page">
      <SiteHeader />
      <div className="empty-state" role="alert">
        <p>Something went wrong loading the timeline.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
