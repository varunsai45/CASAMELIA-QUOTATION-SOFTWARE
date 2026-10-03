import "./globals.css";
import "./responsive.css";
import type { Metadata } from "next";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#515c44",
};
export const metadata: Metadata = {
  title: "CASAMELIA QUOTATION SOFTWARE",
  description: "Casamelia International quotation management",
  appleWebApp: { capable: true, title: "Casamelia", statusBarStyle: "default" },
  icons: { icon: "/app-icon.svg", apple: "/app-logo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
