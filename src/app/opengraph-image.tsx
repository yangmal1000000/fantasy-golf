import { ImageResponse } from "next/og";

export const alt = "Fantasy Golf — Rocket Classic closed test flight";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "radial-gradient(circle at 82% 18%, rgba(221,199,127,.22), transparent 24%), linear-gradient(125deg, #061f16, #0a3d2a 58%, #142d22)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "74px 84px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <div
            style={{
              alignItems: "center",
              background: "#d3b34d",
              borderRadius: 999,
              color: "#073724",
              display: "flex",
              fontSize: 31,
              fontWeight: 900,
              height: 66,
              justifyContent: "center",
              width: 66,
            }}
          >
            ⚑
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>
            Fantasy Golf
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#e6cf87",
              display: "flex",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 5,
              textTransform: "uppercase",
            }}
          >
            Closed test flight · Detroit
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1.02,
              marginTop: 22,
              maxWidth: 900,
            }}
          >
            Read the target. Build the team.
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.72)",
              display: "flex",
              fontSize: 25,
              marginTop: 25,
            }}
          >
            Rocket Classic · Detroit Golf Club · 30 Jul–2 Aug 2026
          </div>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,.52)",
            display: "flex",
            fontSize: 18,
          }}
        >
          Invitation only · no payment · no cash value · no prize
        </div>
      </div>
    ),
    size,
  );
}
