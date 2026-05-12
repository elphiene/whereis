const TRACCAR_URL = process.env.TRACCAR_URL ?? 'http://traccar:8082';
const TRACCAR_ADMIN_EMAIL = process.env.TRACCAR_ADMIN_EMAIL ?? '';
const TRACCAR_ADMIN_PASSWORD = process.env.TRACCAR_ADMIN_PASSWORD ?? '';

const adminAuth = `Basic ${Buffer.from(`${TRACCAR_ADMIN_EMAIL}:${TRACCAR_ADMIN_PASSWORD}`).toString('base64')}`;

export async function traccarAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: adminAuth,
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${TRACCAR_URL}${path}`, { ...options, headers });
}

export { TRACCAR_URL };

export const NTFY_BASE_URL = process.env.NTFY_BASE_URL ?? 'https://ntfy.sh';
