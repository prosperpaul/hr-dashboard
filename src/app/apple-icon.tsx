import { ImageResponse } from "next/og";

/*
  Home-screen icon for iPhone/iPad ("Add to Home Screen"). Apple devices
  don't accept SVG icons, so Next.js renders this to a 180×180 PNG at build
  time. Same design as app/icon.svg. (Apple rounds the corners itself, so the
  emerald fills the whole square.)
*/
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #34d399 0%, #059669 100%)",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="#06281c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
