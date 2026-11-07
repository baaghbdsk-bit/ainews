/**
 * Real-time IndexNow protocol integration.
 * Instantly alerts Bing, Yandex, Seznam, and partner engines when new URLs or stories are published.
 */

export const INDEXNOW_KEY = 'c03e81fe4bf048ea987977175ca067f9';

export async function submitToIndexNow(urls: string[]): Promise<{ success: boolean; status: number; message: string }> {
  if (!urls || urls.length === 0) {
    return { success: true, status: 200, message: 'No URLs provided.' };
  }

  const host = 'app.neubench.workers.dev';
  const keyLocation = `https://${host}/${INDEXNOW_KEY}.txt`;

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList: urls.slice(0, 100), // IndexNow accepts up to 10,000 URLs per post
  };

  try {
    // Submit to Bing's primary IndexNow endpoint which syndicates across all IndexNow partners
    const res = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    // 200 or 202 means submitted / accepted
    const success = res.status === 200 || res.status === 202;
    return {
      success,
      status: res.status,
      message: success
        ? `Successfully submitted ${payload.urlList.length} URLs to Bing & IndexNow.`
        : `IndexNow responded with status ${res.status}`,
    };
  } catch (err) {
    console.error('Failed to submit URLs to IndexNow:', err);
    return {
      success: false,
      status: 500,
      message: err instanceof Error ? err.message : 'Unknown IndexNow error',
    };
  }
}
