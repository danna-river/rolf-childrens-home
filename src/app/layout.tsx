import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import { PublicAnalytics } from "@/components/public-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Children's Homes",
  description: "River of Life Foundation — giving un-homed children a home.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions inject attributes on <body>
          before React hydrates, which would otherwise log a mismatch warning. */}
      <body className="min-h-full flex flex-col overflow-x-hidden" suppressHydrationWarning>
        {children}
        <PublicAnalytics />
      </body>
    </html>
  );
}
