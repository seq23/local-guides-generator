/**
 * One build feeds six Pages projects. Five of them are served on a real
 * production domain and canonicalise to it. The sixth, the base project
 * local-guides-generator.pages.dev, has no domain of its own, so it
 * self-canonicalises to its pages.dev hostname and publishes a full duplicate
 * of all five verticals under a hostname that competes with them.
 *
 * The canonical tag is baked into the static HTML at build time, so it cannot
 * distinguish the hostname it will be served from. The hostname is only known
 * per request, which is why this lives in middleware rather than in the
 * generator: any *.pages.dev hostname gets X-Robots-Tag: noindex, and the
 * production domains are left exactly as they were.
 *
 * This also covers the five verticals' own *.pages.dev preview hostnames,
 * which is the same duplicate-content problem in miniature and equally
 * unwanted in an index.
 */
export async function onRequest(context) {
  const res = await context.next();
  let hostname = '';
  try {
    hostname = new URL(context.request.url).hostname;
  } catch {
    // An unparseable request URL is not a reason to fail the response. Serving
    // it unchanged matches the behaviour before this middleware existed.
    return res;
  }
  if (!hostname.endsWith('.pages.dev')) return res;
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
