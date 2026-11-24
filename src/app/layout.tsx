import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

// Editorial display face for headlines & big numbers.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Clean geometric sans for body text, tables and controls.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HR Dashboard",
  description: "A modern dashboard for managing people, teams, and HR operations.",
};

/*
  Phone viewport settings.
  • viewportFit "cover" lets the page reach under the notch / home bar, so
    our safe-area padding (env(safe-area-inset-*)) can place things properly.
  • themeColor tints the phone's browser bar navy, to run into the navy top bar.
  We deliberately do NOT block pinch-zoom (accessibility).
*/
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#101b3a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1128" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs BEFORE the page is painted, so there's no flash of the wrong
          theme: use the saved choice, otherwise the light "paper" look
          (the design system's default). (suppressHydrationWarning above allows this
          attribute to differ from the server-rendered HTML.)
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t="light"}document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
