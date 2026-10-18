import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ainews-smel.vercel.app"),
  title: "Signal — The AI Timeline",
  description:
    "A living index of the breakthroughs, launches, and decisions moving artificial intelligence forward.",
  // Relative canonical: Next resolves './' against each page's own URL, so
  // every route gets a self-referencing canonical without hardcoding paths.
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "Signal — The AI Timeline",
    description:
      "A living index of the breakthroughs, launches, and decisions moving artificial intelligence forward.",
    siteName: "Signal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}
        <Analytics />
      </body>
    </html>
  );
}
