import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #061f16, #0a3d2a)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#d3b34d",
            border: "10px solid rgba(255,255,255,.12)",
            borderRadius: 999,
            boxShadow: "0 24px 70px rgba(0,0,0,.35)",
            display: "flex",
            height: 300,
            justifyContent: "center",
            position: "relative",
            width: 300,
          }}
        >
          <div
            style={{
              background: "#073724",
              borderRadius: 6,
              display: "flex",
              height: 178,
              marginLeft: -48,
              width: 18,
            }}
          />
          <div
            style={{
              background: "#073724",
              clipPath: "polygon(0 0, 100% 50%, 0 100%)",
              display: "flex",
              height: 104,
              left: 136,
              position: "absolute",
              top: 68,
              width: 118,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
