import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "./site-header";

export default function NotFound() {
  return (
    <main className="site-frame archive-page">
      <SiteHeader
        right={
          <Link className="topbar-link" href="/">
            <ArrowLeft size={15} /> Back to timeline
          </Link>
        }
      />
      <div className="empty-state">
        <h1>That story isn&apos;t on the timeline.</h1>
        <Link className="filter-clear-button" href="/">
          Back to timeline
        </Link>
      </div>
    </main>
  );
}
