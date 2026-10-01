import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "HirePilot AI", description: "Resume intelligence and live AI interview coaching." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
