import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EffortLog",
  description: "Federal grant time & effort reporting",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EffortLog",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geist.className} bg-slate-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
