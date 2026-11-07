import { redirect } from 'next/navigation';

type ExploreSearchParams = Promise<Record<string, string | string[] | undefined>>;

const ROUTES: Record<string, string> = {
  latest: '/latest',
  trending: '/trending',
  saved: '/saved',
  benchmarks: '/benchmarks',
  about: '/about',
  connect: '/connect',
  feedback: '/connect',
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: ExploreSearchParams;
}) {
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const target = ROUTES[view ?? 'latest'] ?? '/latest';
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'view' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }

  const queryString = query.toString();
  redirect(queryString ? `${target}?${queryString}` : target);
}
