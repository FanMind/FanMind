import { ImageResponse } from "next/og";
import { FanMindAppIconMark } from "@/lib/fanmindAppIcon";
import { fanMindDescription, fanMindOgAlt } from "./brandMetadata";

export const alt = fanMindOgAlt;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #06111f 0%, #122447 45%, #7c3aed 100%)",
          color: "#f8fbff",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-140px",
            top: "-170px",
            width: "520px",
            height: "520px",
            borderRadius: "999px",
            background: "rgba(86, 222, 199, 0.24)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "120px",
            bottom: "-120px",
            width: "430px",
            height: "430px",
            borderRadius: "999px",
            background: "rgba(255, 255, 255, 0.10)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "28px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 24px 60px rgba(0,0,0,0.26)",
              }}
            >
              <FanMindAppIconMark size={88} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "54px", fontWeight: 900, letterSpacing: "-2.5px" }}>FanMind</div>
              <div style={{ color: "#b9fff2", fontSize: "25px", fontWeight: 700 }}>KI-CRM · Copy-&-Open · Human in the loop</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "850px" }}>
            <div style={{ fontSize: "72px", lineHeight: 0.98, fontWeight: 900, letterSpacing: "-4px" }}>
              Fan-Kommunikation professionell verwalten.
            </div>
            <div style={{ color: "#dce7f7", fontSize: "30px", lineHeight: 1.28, fontWeight: 600 }}>{fanMindDescription}</div>
          </div>
          <div style={{ display: "flex", gap: "16px", color: "#06111f", fontSize: "23px", fontWeight: 800 }}>
            {['Kontakte', 'KI-Antwortvorschläge', 'Kontaktwissen', 'Follow-ups'].map((label) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.88)", borderRadius: "999px", padding: "13px 20px" }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
