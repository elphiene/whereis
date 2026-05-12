import { requireAuth } from '../middleware/auth.ts';
import { db } from '../db/schema.ts';
import { json } from '../lib/router.ts';
import { NTFY_BASE_URL } from '../lib/traccar.ts';

interface PrefRow {
  event_type: string;
  scope: string;
  enabled: number;
}

interface NtfyRow {
  topic: string;
  enabled: number;
}

export async function getNotificationPrefs(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const prefs = db
    .prepare<PrefRow, [number]>(
      'SELECT event_type, scope, enabled FROM notification_prefs WHERE user_id = ?',
    )
    .all(user.id);

  const ntfy = db
    .prepare<NtfyRow, [number]>('SELECT topic, enabled FROM ntfy_topics WHERE user_id = ?')
    .get(user.id);

  return json({ prefs, ntfy: ntfy ?? null });
}

export async function putNotificationPrefs(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  let body: { prefs?: unknown; ntfyTopic?: unknown; ntfyEnabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const upsertPref = db.prepare(`
    INSERT INTO notification_prefs (user_id, event_type, scope, enabled)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, event_type, scope) DO UPDATE SET enabled = excluded.enabled
  `);

  if (Array.isArray(body.prefs)) {
    for (const pref of body.prefs as any[]) {
      if (typeof pref.event_type !== 'string' || typeof pref.scope !== 'string') continue;
      if (pref.scope !== 'own' && pref.scope !== 'anyone') continue;
      upsertPref.run(user.id, pref.event_type, pref.scope, pref.enabled ? 1 : 0);
    }
  }

  if (typeof body.ntfyTopic === 'string' && body.ntfyTopic.length > 0) {
    db.prepare(`
      INSERT INTO ntfy_topics (user_id, topic, enabled)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET topic = excluded.topic, enabled = excluded.enabled
    `).run(user.id, body.ntfyTopic, body.ntfyEnabled ? 1 : 0);
  }

  return new Response(null, { status: 204 });
}

export async function sendTestNotification(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const ntfy = db
    .prepare<NtfyRow, [number]>('SELECT topic, enabled FROM ntfy_topics WHERE user_id = ?')
    .get(user.id);

  if (!ntfy || !ntfy.enabled || !ntfy.topic) {
    return json({ error: 'ntfy not configured or disabled' }, 400);
  }

  const res = await fetch(`${NTFY_BASE_URL}/${ntfy.topic}`, {
    method: 'POST',
    body: 'Test notification from WhereIs?',
    headers: { Title: 'WhereIs? Test' },
  });

  if (!res.ok) return json({ error: 'ntfy delivery failed' }, 502);
  return json({ sent: true });
}
