import { NextRequest, NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/seo/indexnow';


export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.neubench.workers.dev';

  const coreUrls = [
    `${siteUrl}/`,
    `${siteUrl}/explore`,
    `${siteUrl}/latest`,
    `${siteUrl}/trending`,
    `${siteUrl}/benchmarks`,
    `${siteUrl}/about`,
    `${siteUrl}/feedback`,
    `${siteUrl}/home`,
    `${siteUrl}/rss.xml`,
    `${siteUrl}/feed.xml`,
  ];

  try {

    const allUrls = Array.from(new Set(coreUrls));

    const result = await submitToIndexNow(allUrls);

    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
      submittedUrlsCount: allUrls.length,
      sampleUrls: allUrls.slice(0, 5),
    });
  } catch (err) {
    console.error('Error in /api/indexnow:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'IndexNow submission failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body.urls) ? body.urls : [];

    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: 'No URLs provided in body.urls' }, { status: 400 });
    }

    const result = await submitToIndexNow(urls);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'IndexNow submission failed' },
      { status: 500 }
    );
  }
}
