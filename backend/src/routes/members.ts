import { requireAuth, requireAdmin } from '../middleware/auth.ts';
import { db } from '../db/schema.ts';
import { traccarAdmin } from '../lib/traccar.ts';
import { json, type Params } from '../lib/router.ts';

interface MemberRow {
  user_id: number;
  traccar_user_id: number;
  role: string;
  joined_at: number;
}

interface DeviceRow {
  user_id: number;
  traccar_device_id: number;
}

interface ColourRow {
  user_id: number;
  colour_hex: string;
}

export async function getMembers(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const members = db.prepare<MemberRow, []>(
    'SELECT user_id, traccar_user_id, role, joined_at FROM group_members',
  ).all();

  const devices = db.prepare<DeviceRow, []>(
    'SELECT user_id, traccar_device_id FROM user_devices',
  ).all();
  const deviceMap = new Map(devices.map(d => [d.user_id, d.traccar_device_id]));

  const colours = db.prepare<ColourRow, []>(
    'SELECT user_id, colour_hex FROM user_colours',
  ).all();
  const colourMap = new Map(colours.map(c => [c.user_id, c.colour_hex]));

  const [usersRes, positionsRes] = await Promise.all([
    traccarAdmin('/api/users'),
    traccarAdmin('/api/positions'),
  ]);

  const traccarUsers: any[] = usersRes.ok ? await usersRes.json() : [];
  const positions: any[] = positionsRes.ok ? await positionsRes.json() : [];
  const traccarUserMap = new Map(traccarUsers.map((u: any) => [u.id, u]));
  const positionByDevice = new Map(positions.map((p: any) => [p.deviceId, p]));

  const result = members.map(m => {
    const tu = traccarUserMap.get(m.traccar_user_id) ?? {};
    const deviceId = deviceMap.get(m.user_id);
    return {
      userId: m.user_id,
      traccarUserId: m.traccar_user_id,
      traccarDeviceId: deviceMap.get(m.user_id) ?? null,
      role: m.role,
      joinedAt: m.joined_at,
      name: (tu as any).name ?? '',
      email: (tu as any).email ?? '',
      colour: colourMap.get(m.user_id) ?? null,
      lastPosition: deviceId != null ? (positionByDevice.get(deviceId) ?? null) : null,
    };
  });

  return json(result);
}

export async function removeMember(req: Request, params: Params): Promise<Response> {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const targetId = parseInt(params.userId!, 10);
  if (isNaN(targetId)) return new Response('Invalid userId', { status: 400 });

  const device = db
    .prepare<{ traccar_device_id: number }, [number]>(
      'SELECT traccar_device_id FROM user_devices WHERE user_id = ?',
    )
    .get(targetId);

  if (device) {
    await traccarAdmin(`/api/devices/${device.traccar_device_id}`, {
      method: 'PUT',
      body: JSON.stringify({ id: device.traccar_device_id, disabled: true }),
    });
  }

  db.prepare('DELETE FROM group_members WHERE user_id = ?').run(targetId);

  return new Response(null, { status: 204 });
}
