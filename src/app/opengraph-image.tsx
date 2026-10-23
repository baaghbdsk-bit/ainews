import { ImageResponse } from "next/og";

export const alt = "NeuBench";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social preview card, styled with the same tokens as the site: paper
 * background, ringed orbit mark, magenta period, violet rule.
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
          backgroundColor: "#000000",
          padding: "0 96px",
          color: "#F4F3FA",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 9999,
              border: "3px solid #8B5CF6",
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
                backgroundColor: "#8B5CF6",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, letterSpacing: -2 }}>
            NeuBench
            <div style={{ color: "#F472B6" }}>.</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 38,
            color: "#A3A8BF",
            letterSpacing: 6,
            fontWeight: 600,
          }}
        >
          THE PULSE OF AI
        </div>
        <div
          style={{
            marginTop: 30,
            width: 170,
            height: 7,
            backgroundColor: "#8B5CF6",
            borderRadius: 4,
          }}
        />
      </div>
    ),
    size,
  );
}
