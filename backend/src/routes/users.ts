import { requireAuth } from '../middleware/auth.ts';
import { db } from '../db/schema.ts';
import { json } from '../lib/router.ts';

export async function getMe(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const colour = db
    .prepare<{ colour_hex: string }, [number]>('SELECT colour_hex FROM user_colours WHERE user_id = ?')
    .get(user.id);
  const member = db
    .prepare<{ role: string }, [number]>('SELECT role FROM group_members WHERE traccar_user_id = ?')
    .get(user.id);
  const ntfy = db
    .prepare<{ enabled: number }, [number]>('SELECT enabled FROM ntfy_topics WHERE user_id = ?')
    .get(user.id);

  return json({
    id: user.id,
    name: user.name,
    email: user.email,
    administrator: user.administrator,
    colour: colour?.colour_hex ?? null,
    role: member?.role ?? 'member',
    ntfyEnabled: ntfy ? ntfy.enabled === 1 : false,
  });
}

export async function patchMyColour(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  let body: { colour?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { colour } = body;
  if (typeof colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colour)) {
    return new Response('Invalid colour — expected #rrggbb hex', { status: 400 });
  }

  db.prepare(`
    INSERT INTO user_colours (user_id, colour_hex, assigned_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET colour_hex = excluded.colour_hex, assigned_at = excluded.assigned_at
  `).run(user.id, colour);

  return json({ colour });
}
