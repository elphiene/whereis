import { requireAuth, requireAdmin } from '../middleware/auth.ts';
import { traccarAdmin } from '../lib/traccar.ts';
import { db } from '../db/schema.ts';
import { json, type Params } from '../lib/router.ts';

function generateToken(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export async function validateInvite(_req: Request, params: Params): Promise<Response> {
  const { token } = params;

  const row = db
    .prepare<
      { token: string; created_by: number; expires_at: number; used_at: number | null },
      [string]
    >('SELECT token, created_by, expires_at, used_at FROM invite_tokens WHERE token = ?')
    .get(token);

  if (!row) return json({ valid: false, reason: 'not_found' }, 404);
  if (row.used_at !== null) return json({ valid: false, reason: 'used' }, 410);
  if (row.expires_at < Math.floor(Date.now() / 1000)) return json({ valid: false, reason: 'expired' }, 410);

  return json({ valid: true, createdBy: row.created_by });
}

export async function createInvite(req: Request): Promise<Response> {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;

  let body: { expiryHours?: unknown } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const expiryHours = body.expiryHours === 24 ? 24 : 168; // 24h or 7 days (default)
  const expiresAt = Math.floor(Date.now() / 1000) + expiryHours * 3600;

  // Invalidate any existing unused tokens from this admin
  db.prepare('DELETE FROM invite_tokens WHERE created_by = ? AND used_at IS NULL').run(user.id);

  const token = generateToken();
  db.prepare('INSERT INTO invite_tokens (token, created_by, expires_at) VALUES (?, ?, ?)').run(
    token, user.id, expiresAt,
  );

  const PUBLIC_URL = process.env.PUBLIC_URL ?? '';
  return json(
    { token, url: `${PUBLIC_URL}/invite?token=${token}`, expiresAt, expiryHours },
    201,
  );
}

export async function deleteActiveInvite(req: Request): Promise<Response> {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;

  db.prepare('DELETE FROM invite_tokens WHERE created_by = ? AND used_at IS NULL').run(user.id);
  return new Response(null, { status: 204 });
}

// Called by the frontend after Traccar account + device creation.
// Stores user in SQLite, shares Traccar device permissions across group, marks token used.
export async function completeRegistration(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  let body: { inviteToken?: unknown; uuid?: unknown; traccarDeviceId?: unknown } = {};
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { inviteToken, uuid, traccarDeviceId } = body;
  if (typeof inviteToken !== 'string' || typeof uuid !== 'string' || typeof traccarDeviceId !== 'number') {
    return new Response('Missing or invalid fields', { status: 400 });
  }

  const token = db
    .prepare<{ created_by: number }, [string]>(
      'SELECT created_by FROM invite_tokens WHERE token = ? AND used_at IS NULL AND expires_at > unixepoch()',
    )
    .get(inviteToken);
  if (!token) return json({ error: 'Invalid or expired invite' }, 410);

  // Store user in group and device mapping
  db.prepare(
    'INSERT OR IGNORE INTO group_members (user_id, traccar_user_id, role) VALUES (?, ?, ?)',
  ).run(user.id, user.id, 'member');
  db.prepare(
    'INSERT OR REPLACE INTO user_devices (user_id, uuid, traccar_device_id) VALUES (?, ?, ?)',
  ).run(user.id, uuid, traccarDeviceId);

  // Mark token consumed
  db.prepare('UPDATE invite_tokens SET used_by = ?, used_at = unixepoch() WHERE token = ?').run(
    user.id, inviteToken,
  );

  // Share existing group devices with the new user, and new device with existing members
  const existingMembers = db
    .prepare<{ traccar_user_id: number }, [number]>(
      'SELECT traccar_user_id FROM group_members WHERE user_id != ?',
    )
    .all(user.id);
  const existingDevices = db
    .prepare<{ traccar_device_id: number }, [number]>(
      'SELECT traccar_device_id FROM user_devices WHERE user_id != ?',
    )
    .all(user.id);

  await Promise.all([
    ...existingDevices.map((d) =>
      traccarAdmin('/api/permissions', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, deviceId: d.traccar_device_id }),
      }),
    ),
    ...existingMembers.map((m) =>
      traccarAdmin('/api/permissions', {
        method: 'POST',
        body: JSON.stringify({ userId: m.traccar_user_id, deviceId: traccarDeviceId }),
      }),
    ),
  ]);

  return json({ success: true });
}
