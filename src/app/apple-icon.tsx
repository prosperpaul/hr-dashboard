import { ImageResponse } from "next/og";

/*
  Home-screen icon for iPhone/iPad ("Add to Home Screen"). Apple devices
  don't accept SVG icons, so Next.js renders this to a 180×180 PNG at build
  time. Same design as app/icon.svg: a butter-yellow tile with the navy
  "network" mark from the sidebar. (Apple rounds the corners itself, so the
  yellow fills the whole square.)
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
          background: "#F5C518",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="#101B3A" stroke="#101B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" fill="none" />
          <path d="M12 12V8" fill="none" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
