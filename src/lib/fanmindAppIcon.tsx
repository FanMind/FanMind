export const fanMindAppIconBrand = {
  background:
    "radial-gradient(circle at 30% 18%, rgba(103, 232, 249, 0.16) 0, rgba(103, 232, 249, 0) 34%), linear-gradient(135deg, #02040a 0%, #050816 45%, #0b1024 100%)",
  border: "rgba(103, 232, 249, 0.5)",
  innerBorder: "rgba(255, 255, 255, 0.1)",
  glow: "rgba(56, 189, 248, 0.28)",
  shadow: "rgba(0, 0, 0, 0.34)",
  fan: "#f8fdff",
  mind: "#67e8f9",
} as const;

type FanMindAppIconMarkProps = {
  size: number;
};

export function FanMindAppIconMark({ size }: FanMindAppIconMarkProps) {
  const radius = Math.round(size * 0.28);
  const borderWidth = Math.max(1, Math.round(size * 0.025));
  const innerInset = Math.max(2, Math.round(size * 0.07));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fanMindAppIconBrand.background,
      }}
    >
      <div
        style={{
          position: "relative",
          width: `${size - innerInset}px`,
          height: `${size - innerInset}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: `${radius}px`,
          border: `${borderWidth}px solid ${fanMindAppIconBrand.border}`,
          background: fanMindAppIconBrand.background,
          boxShadow: `0 0 ${Math.round(size * 0.26)}px ${fanMindAppIconBrand.glow}, 0 ${Math.round(size * 0.12)}px ${Math.round(size * 0.28)}px ${fanMindAppIconBrand.shadow}, inset 0 0 0 1px ${fanMindAppIconBrand.innerBorder}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: `${Math.round(size * -0.22)}px`,
            right: `${Math.round(size * -0.2)}px`,
            width: `${Math.round(size * 0.78)}px`,
            height: `${Math.round(size * 0.78)}px`,
            borderRadius: "999px",
            background: "rgba(8, 47, 73, 0.22)",
            filter: `blur(${Math.max(6, Math.round(size * 0.08))}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${Math.round(size * -0.14)}px`,
            bottom: `${Math.round(size * -0.16)}px`,
            width: `${Math.round(size * 0.66)}px`,
            height: `${Math.round(size * 0.66)}px`,
            borderRadius: "999px",
            background: "rgba(14, 165, 233, 0.16)",
            filter: `blur(${Math.max(5, Math.round(size * 0.07))}px)`,
          }}
        />
        <svg
          aria-hidden="true"
          width="76%"
          height="64%"
          viewBox="0 0 184 120"
          style={{
            position: "relative",
            display: "block",
            overflow: "visible",
            filter: `drop-shadow(0 0 ${Math.max(2, Math.round(size * 0.042))}px rgba(103, 232, 249, 0.55))`,
          }}
        >
          <path
            d="M24 102 V18 H80 M24 58 H72"
            fill="none"
            stroke={fanMindAppIconBrand.fan}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="20"
          />
          <path
            d="M94 102 V18 L129 62 L164 18 V102"
            fill="none"
            stroke={fanMindAppIconBrand.mind}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="19"
          />
        </svg>
      </div>
    </div>
  );
}
