import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVERA — Liquid AI Agent",
  description:
    "AI Computer-Use Agent powered by Liquid AI LFM2. Chat interface for on-device AI assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans font-light selection:bg-stone-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
