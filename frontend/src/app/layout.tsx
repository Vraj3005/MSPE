import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Surface Projection Engine (MSPE)",
  description: "MSPE shows possible future price ranges, downside risk, and historical reliability using Monte Carlo simulation and risk analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
