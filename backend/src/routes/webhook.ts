import { db } from '../db/schema.ts';

const NTFY_BASE_URL = process.env.NTFY_BASE_URL ?? 'https://ntfy.sh';

interface TraccarWebhookPayload {
  event?: {
    id: number;
    type: string;
    deviceId: number;
    positionId?: number;
    geofenceId?: number;
    attributes?: Record<string, unknown>;
  };
  device?: {
    id: number;
    name: string;
  };
  geofence?: { name: string };
  position?: Record<string, unknown>;
}

const EVENT_LABELS: Record<string, string> = {
  geofenceEnter:  'entered a geofence',
  geofenceExit:   'exited a geofence',
  overspeed:      'is speeding',
  deviceOffline:  'went offline',
  deviceOnline:   'came online',
  lowBattery:     'has low battery',
  ignitionOn:     'ignition on',
  ignitionOff:    'ignition off',
};

interface DeviceRow  { user_id: number }
interface MemberRow  { user_id: number }
interface NtfyRow    { topic: string; enabled: number }
interface PrefRow    { enabled: number }

export async function handleWebhook(req: Request): Promise<Response> {
  let payload: TraccarWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { event, device, geofence } = payload;
  if (!event || !device) return new Response('OK', { status: 200 });

  const { type: eventType, deviceId } = event;

  // Resolve Traccar device → owning user
  const deviceRow = db
    .prepare<DeviceRow, [number]>('SELECT user_id FROM user_devices WHERE traccar_device_id = ?')
    .get(deviceId);

  if (!deviceRow) return new Response('OK', { status: 200 }); // untracked device

  const ownerId = deviceRow.user_id;
  const members = db.prepare<MemberRow, []>('SELECT user_id FROM group_members').all();

  const label = EVENT_LABELS[eventType] ?? eventType;
  const geofenceSuffix = geofence?.name ? ` (${geofence.name})` : '';
  const notifBody = `${device.name} ${label}${geofenceSuffix}`;

  const notifications: Promise<void>[] = [];

  for (const member of members) {
    const isOwner = member.user_id === ownerId;
    const scope = isOwner ? 'own' : 'anyone';

    const pref = db
      .prepare<PrefRow, [number, string, string]>(
        'SELECT enabled FROM notification_prefs WHERE user_id = ? AND event_type = ? AND scope = ?',
      )
      .get(member.user_id, eventType, scope);

    // Skip if not explicitly enabled (opt-in model)
    if (!pref || !pref.enabled) continue;

    const ntfy = db
      .prepare<NtfyRow, [number]>('SELECT topic, enabled FROM ntfy_topics WHERE user_id = ?')
      .get(member.user_id);

    if (!ntfy || !ntfy.enabled || !ntfy.topic) continue;

    notifications.push(
      fetch(`${NTFY_BASE_URL}/${ntfy.topic}`, {
        method: 'POST',
        body: notifBody,
        headers: { Title: 'WhereIs?' },
      })
        .then(() => {})
        .catch((err) => console.error(`ntfy delivery failed for user ${member.user_id}:`, err)),
    );
  }

  await Promise.all(notifications);
  return new Response('OK', { status: 200 });
}
