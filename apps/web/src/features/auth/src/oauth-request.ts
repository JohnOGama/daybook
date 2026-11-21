// An app (ChatGPT, Claude…) is waiting for this sign-in when Better Auth sent the person here with its signed query.
export const appIsWaiting = (search = window.location.search) => new URLSearchParams(search).has('sig');

// A full page load, because the app's callback is on another site.
export const leaveFor = (url: string) => window.location.assign(url);

// Keeps a waiting app's signed query when the person moves between auth pages (sign-up, the code screen,
// a password reset), so signing in at the end still continues to the app. The email is the page's own.
export function withWaitingApp(path: string, search = typeof window === 'undefined' ? '' : window.location.search): string {
  const carried = new URLSearchParams(search);
  if (!carried.has('sig')) return path;
  carried.delete('email');
  const [base, own = ''] = path.split('?');
  const merged = new URLSearchParams(own);
  for (const [key, value] of carried) merged.append(key, value);
  return `${base}?${merged}`;
}
