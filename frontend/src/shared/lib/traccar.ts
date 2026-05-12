// VITE_SERVER_URL is baked in at build time.
// Used only for constructing Traccar Client deep links (onboarding step 4):
//   traccar://connect?url=${SERVER_URL}/api&id={uuid}&period=60
// All API calls use relative paths — nginx proxies them on the same origin.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

// Wrapper for all API calls. Sends credentials (JSESSIONID cookie) on every request.
export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}
