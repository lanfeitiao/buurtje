import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buurtje — Know your neighborhood before you move",
  description: "Explore Dutch neighborhoods with local stats, housing data, amenities, and election results. Built for expats and newcomers to the Netherlands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
