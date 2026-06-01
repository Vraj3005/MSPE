import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSPE // Quant Portal",
  description: "Market Surface Projection Engine - Quantitative Finance & Risk Analytics System",
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
