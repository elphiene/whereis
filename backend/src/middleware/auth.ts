import { db } from '../db/schema.ts';
import { TRACCAR_URL } from '../lib/traccar.ts';

export interface TraccarUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
  disabled: boolean;
  attributes: Record<string, unknown>;
}

// Resolves JSESSIONID cookie to a Traccar user.
// Returns a 401 Response if the session is invalid.
export async function requireAuth(req: Request): Promise<TraccarUser | Response> {
  const cookie = req.headers.get('cookie') ?? '';
  const res = await fetch(`${TRACCAR_URL}/api/session`, {
    headers: { cookie },
  });
  if (res.status === 401) return new Response('Unauthorized', { status: 401 });
  if (!res.ok) return new Response('Auth service error', { status: 502 });
  return res.json() as Promise<TraccarUser>;
}

// Like requireAuth, but additionally checks group_members.role = 'admin'.
// Returns 401 if unauthenticated, 403 if authenticated but not admin.
export async function requireAdmin(req: Request): Promise<TraccarUser | Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const member = db
    .prepare<{ role: string }, [number]>(
      'SELECT role FROM group_members WHERE traccar_user_id = ?',
    )
    .get(user.id);

  if (!member || member.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }
  return user;
}
