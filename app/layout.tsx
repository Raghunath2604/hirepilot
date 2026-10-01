import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthBar } from "@/components/AuthBar";

export const metadata: Metadata = {
  title: "HirePilot AI",
  description: "Resume intelligence and live AI interview coaching."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="shell top">
          <div className="brand">
            <div className="logo">HP</div>
            <div>
              <b>HirePilot AI</b>
              <p className="muted tiny">Private interview coaching workspace</p>
            </div>
          </div>
          <div className="actions">
            <Link className="button ghost" href="/">
              Analyze Resume
            </Link>
            <Link className="button ghost" href="/dashboard">
              Dashboard
            </Link>
          </div>
          <AuthBar />
        </header>
        {children}
      </body>
    </html>
  );
}
