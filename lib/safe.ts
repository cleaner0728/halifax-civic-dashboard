// Defense-in-depth wrapper for SSR data fetches.
//
// Each fetcher already has its own try/catch returning a sensible "empty"
// value, so an exception escaping is unexpected — but if one slips through
// (e.g. a future refactor drops a try/catch, or a sync error fires before
// await), we don't want the entire page to 500. Wrap each fetcher in safe()
// and the worst case is a single empty tab.

export async function safe<T>(promise: Promise<T>, fallback: T, label?: string): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (label) console.error(`[safe] ${label} threw:`, e);
    return fallback;
  }
}
