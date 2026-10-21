"use client";

/**
 * Last-resort error boundary. Replaces the root layout when it (or the shell)
 * throws, so it must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#080A12",
          color: "#F4F3FA",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div role="alert" style={{ textAlign: "center", padding: 24 }}>
          <p>NeuBench. hit an unexpected error.</p>
          {error.digest ? (
            <p style={{ opacity: 0.6, fontSize: 12 }}>Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #8B5CF6",
              background: "transparent",
              color: "#8B5CF6",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
