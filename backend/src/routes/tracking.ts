import { requireAuth } from '../middleware/auth.ts';
import { db } from '../db/schema.ts';
import { traccarAdmin } from '../lib/traccar.ts';
import { json } from '../lib/router.ts';

async function setDeviceDisabled(userId: number, disabled: boolean): Promise<Response | null> {
  const device = db
    .prepare<{ traccar_device_id: number }, [number]>(
      'SELECT traccar_device_id FROM user_devices WHERE user_id = ?',
    )
    .get(userId);

  if (!device) return new Response('Device not found', { status: 404 });

  const res = await traccarAdmin(`/api/devices/${device.traccar_device_id}`, {
    method: 'PUT',
    body: JSON.stringify({ id: device.traccar_device_id, disabled }),
  });

  if (!res.ok) return new Response('Traccar error', { status: 502 });
  return null;
}

export async function pauseTracking(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const err = await setDeviceDisabled(user.id, true);
  if (err) return err;
  return json({ paused: true });
}

export async function resumeTracking(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const err = await setDeviceDisabled(user.id, false);
  if (err) return err;
  return json({ paused: false });
}

export async function leaveGroup(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const device = db
    .prepare<{ traccar_device_id: number }, [number]>(
      'SELECT traccar_device_id FROM user_devices WHERE user_id = ?',
    )
    .get(user.id);

  if (device) {
    // Disable first so Traccar stops accepting positions, then delete
    await traccarAdmin(`/api/devices/${device.traccar_device_id}`, {
      method: 'PUT',
      body: JSON.stringify({ id: device.traccar_device_id, disabled: true }),
    });
    await traccarAdmin(`/api/devices/${device.traccar_device_id}`, { method: 'DELETE' });
  }

  // Delete Traccar user account (cascades positions server-side)
  await traccarAdmin(`/api/users/${user.id}`, { method: 'DELETE' });

  // Clean up all SQLite rows for this user
  db.prepare('DELETE FROM group_members WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM user_devices WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM user_colours WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM ntfy_topics WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM notification_prefs WHERE user_id = ?').run(user.id);

  return new Response(null, { status: 204 });
}
