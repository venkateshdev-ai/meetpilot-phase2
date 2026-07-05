import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetPilot",
  description:
    "Unified meeting copilot and workspace booking platform for IT teams and SMEs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
