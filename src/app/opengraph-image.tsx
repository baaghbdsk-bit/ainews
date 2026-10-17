import { ImageResponse } from "next/og";

export const alt = "Signal — The AI Timeline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social preview card, styled with the same tokens as the site: paper
 * background, ringed orbit mark, coral period, acid-green rule.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#111611",
          padding: "0 96px",
          color: "#f2f5e9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 9999,
              border: "3px solid #53634e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 9999,
                backgroundColor: "#d6ff55",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, letterSpacing: -2 }}>
            signal
            <div style={{ color: "#ff755e" }}>.</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 38,
            color: "#a7b3a4",
            letterSpacing: 6,
            fontWeight: 600,
          }}
        >
          THE AI TIMELINE
        </div>
        <div
          style={{
            marginTop: 30,
            width: 170,
            height: 7,
            backgroundColor: "#d6ff55",
            borderRadius: 4,
          }}
        />
      </div>
    ),
    size,
  );
}
