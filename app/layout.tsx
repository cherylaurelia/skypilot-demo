import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkyPilot managed jobs fail after a wall clock step",
  description:
    "controller_process_alive compares psutil's epoch create_time() by exact equality, so a clock step on the jobs controller marks a live controller dead. A controlled repro on local kind and a small patch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
