import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { WelcomeGate } from "@/components/auth/welcome-gate";
import { GuestNotice } from "@/components/auth/guest-notice";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://neubench.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "NeuBench",
  description:
    "The living pulse of artificial intelligence: comprehensive frontier model benchmarks, capability economics, and real-time breakthrough radar.",
  // Relative canonical: Next resolves './' against each page's own URL, so
  // every route gets a self-referencing canonical without hardcoding paths.
  alternates: {
    canonical: "./",
  },
  // The `?v=2` query forces browsers to re-fetch the favicon
  // instead of serving a stale cached copy from the favicon database.
  icons: {
    icon: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg?v=2" }],
  },
  openGraph: {
title: "NeuBench",
    description:
      "The living pulse of artificial intelligence: comprehensive frontier model benchmarks, capability economics, and real-time breakthrough radar.",
    siteName: "NeuBench",
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
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem("neubench-theme");if(t==="light")document.documentElement.dataset.theme="light";}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                  "name": "NeuBench",
                  "url": siteUrl,
                  "logo": `${siteUrl}/neubench-logo.svg`,
                  "description": "Frontier AI model benchmarking, capability economics, and real-time intelligence observatory.",
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}/#website`,
                  "url": siteUrl,
                  "name": "NeuBench",
                  "description": "The Pulse of AI ? Frontier Model Benchmarks, Capability Economics & Living Intelligence",
                  "publisher": {
                    "@id": `${siteUrl}/#organization`,
                  },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": `${siteUrl}/?q={search_term_string}`,
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <style>{`
.skip-to-stories {
  position: fixed;
  top: -80px;
  left: 12px;
  z-index: 300;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  transition: top 120ms ease;
}
.skip-to-stories:focus {
  top: 12px;
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}
          .timeline-result-bar {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin: 10px 2px 2px;
            min-height: 20px;
          }
          .timeline-result-count {
            color: var(--muted, #a3a8bf);
            font-size: 12px;
            font-variant-numeric: tabular-nums;
          }
          @media (max-width: 1080px) {
            .archive-page .header-filter-wrapper {
              display: none;
            }
            .header-icon-button {
              min-width: 44px;
              min-height: 44px;
            }
            .hero-stat-pill {
              min-height: 44px;
            }
            .story-actions-bar .story-action-btn,
            .story-expand-actions .story-action-btn,
            .story-article-actions .story-action-btn {
              min-width: 44px;
              min-height: 44px;
              justify-content: center;
            }
            .full-story-link-btn {
              min-height: 44px;
            }
            .source-link,
            .story-article-source a {
              min-height: 44px;
              align-items: center;
            }
            /* The visible circle stays 25px; the transparent hit area is 45px. */
            .expand-icon {
              position: relative;
            }
            .expand-icon::after {
              content: "";
              position: absolute;
              inset: -10px;
              border-radius: 999px;
            }
            .share-menu-item {
              min-height: 44px;
            }
            .company-select-option {
              min-height: 44px;
            }
          }
          .mobile-filter-overlay {
            position: fixed;
            inset: 0;
            z-index: 130;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(4, 6, 12, 0.62);
            backdrop-filter: blur(3px);
          }
          .mobile-filter-sheet {
            width: 100%;
            max-width: 560px;
            max-height: 85dvh;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
            border: 1px solid rgba(139, 92, 246, 0.32);
            border-bottom: 0;
            border-radius: 18px 18px 0 0;
            background: #18181b;
            box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.6);
          }
          html[data-theme="light"] .mobile-filter-sheet {
            background: #ffffff;
            border-color: #d3c9e3;
          }
          .mobile-filter-sheet .company-select-option[data-active="true"] {
            background: #18181b;
          }
          html[data-theme="light"] .mobile-filter-sheet .company-select-option[data-active="true"] {
            background: #ede6f9;
          }
          @media (prefers-reduced-motion: reduce) {
            .skip-to-stories {
              transition: none;
            }
          }
        `}</style>
        {children}
        <WelcomeGate />
        <AuthDialog />
        <GuestNotice />
        <Analytics />
      </body>
    </html>
  );
}
