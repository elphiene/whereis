import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';
import { useOnboardingState } from '@/features/onboarding/hooks/useOnboardingState';
import QRCode from 'qrcode';

const EVENT_TYPES = [
  { key: 'geofenceEnter',  label: 'Geofence entered', defaults: { own: true,  anyone: true  } },
  { key: 'geofenceExit',   label: 'Geofence exited',  defaults: { own: true,  anyone: true  } },
  { key: 'overspeed',      label: 'Speeding',         defaults: { own: true,  anyone: true  } },
  { key: 'deviceOffline',  label: 'Device offline',   defaults: { own: true,  anyone: false } },
  { key: 'lowBattery',     label: 'Low battery',      defaults: { own: true,  anyone: false } },
] as const;

type PrefsMap = Record<string, { own: boolean; anyone: boolean }>;

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative h-[19px] w-[34px] flex-shrink-0 cursor-pointer rounded-[10px] transition-colors ${on ? 'bg-[#ec4899]' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-[3px] h-[13px] w-[13px] rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-[3px]'}`} />
    </button>
  );
}

export function NotificationsSection() {
  const { user } = useAuthStore();
  const { state: onbState } = useOnboardingState();

  const [prefs,       setPrefs]       = useState<PrefsMap>(() =>
    Object.fromEntries(EVENT_TYPES.map((e) => [e.key, { own: e.defaults.own, anyone: e.defaults.anyone }]))
  );
  const [ntfyTopic,   setNtfyTopic]   = useState('');
  const [ntfyEnabled, setNtfyEnabled] = useState(false);
  const [qrSrc,       setQrSrc]       = useState<string | null>(null);
  const [copied,      setCopied]       = useState(false);
  const [saving,      setSaving]       = useState(false);
  const [testing,     setTesting]      = useState(false);
  const [toast,       setToast]        = useState<string | null>(null);
  const [error,       setError]        = useState<string | null>(null);

  useEffect(() => {
    api('/backend/notifications/prefs')
      .then((r) => r.json())
      .then((data: { prefs: { event_type: string; scope: string; enabled: number }[]; ntfy: { topic: string; enabled: number } | null }) => {
        if (data.prefs.length > 0) {
          const map: PrefsMap = { ...Object.fromEntries(EVENT_TYPES.map((e) => [e.key, { ...e.defaults }])) };
          data.prefs.forEach((p) => {
            if (!map[p.event_type]) map[p.event_type] = { own: false, anyone: false };
            if (p.scope === 'own')    map[p.event_type].own    = p.enabled === 1;
            if (p.scope === 'anyone') map[p.event_type].anyone = p.enabled === 1;
          });
          setPrefs(map);
        }
        if (data.ntfy) {
          setNtfyTopic(data.ntfy.topic);
          setNtfyEnabled(data.ntfy.enabled === 1);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ntfyTopic) return;
    QRCode.toDataURL(`ntfy://${ntfyTopic}`, { width: 120, color: { dark: '#ec4899', light: '#101010' }, margin: 2 })
      .then(setQrSrc).catch(() => {});
  }, [ntfyTopic]);

  function togglePref(key: string, scope: 'own' | 'anyone') {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [scope]: !p[key][scope] } }));
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const prefsArray = EVENT_TYPES.flatMap((e) => [
        { event_type: e.key, scope: 'own',    enabled: prefs[e.key]?.own    ?? false },
        { event_type: e.key, scope: 'anyone', enabled: prefs[e.key]?.anyone ?? false },
      ]);
      const res = await api('/backend/notifications/prefs', {
        method: 'PUT',
        body: JSON.stringify({ prefs: prefsArray, ntfyTopic, ntfyEnabled }),
      });
      if (!res.ok) { setError('Save failed.'); return; }
      setToast('Preferences saved'); setTimeout(() => setToast(null), 2500);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await api('/backend/notify/test', { method: 'POST' });
      const body = await res.json();
      if (body.error) setError(body.error);
      else { setToast('Test sent!'); setTimeout(() => setToast(null), 2000); }
    } catch { setError('Network error.'); }
    finally { setTesting(false); }
  }

  return (
    <section id="notifications" className="rounded-[10px] border border-white/[0.07] bg-[#101010]">
      <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-bold">Notifications</div>
      <div className="flex flex-col gap-5 px-5 py-5">
        {toast && <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-3 py-2 font-mono text-xs text-[#22c55e]">{toast}</div>}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">{error}</div>}

        {/* Events grid */}
        <div>
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-[#666]">Events</p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="pb-2 text-left font-mono text-[11px] font-medium text-[#666]" />
                <th className="pb-2 text-center font-mono text-[11px] font-medium text-[#666]">Own</th>
                <th className="pb-2 text-center font-mono text-[11px] font-medium text-[#666]">Anyone</th>
              </tr>
            </thead>
            <tbody>
              {EVENT_TYPES.map((e) => (
                <tr key={e.key} className="border-t border-white/[0.07]">
                  <td className="py-2 text-sm text-white">{e.label}</td>
                  <td className="py-2 text-center">
                    <Toggle on={prefs[e.key]?.own ?? false} onToggle={() => togglePref(e.key, 'own')} />
                  </td>
                  <td className="py-2 text-center">
                    <Toggle on={prefs[e.key]?.anyone ?? false} onToggle={() => togglePref(e.key, 'anyone')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ntfy section */}
        <div className="border-t border-white/[0.07] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-[#666]">ntfy (optional)</p>
              <a href="https://ntfy.sh" target="_blank" rel="noreferrer"
                className="font-mono text-[11px] text-[#ec4899] hover:underline">
                Install ntfy app ↗
              </a>
            </div>
            <Toggle on={ntfyEnabled} onToggle={() => setNtfyEnabled((v) => !v)} />
          </div>

          {ntfyTopic && (
            <>
              <p className="mb-1 font-mono text-[11px] text-[#666]">Your topic</p>
              <div className="mb-3 flex gap-1.5">
                <input readOnly value={ntfyTopic}
                  className="flex-1 rounded-lg border border-white/[0.12] bg-[#161616] px-3 py-2 font-mono text-[10px] text-[#a0a0a0]" />
                <button onClick={() => { navigator.clipboard.writeText(ntfyTopic); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="rounded-lg border border-white/[0.12] bg-[#161616] px-3 font-mono text-[11px] text-[#a0a0a0] hover:text-white">
                  {copied ? '✓' : '⎘'}
                </button>
              </div>
              {qrSrc && <img src={qrSrc} alt="ntfy QR" width={100} height={100} className="mb-3 rounded-lg" />}
              <button onClick={handleTest} disabled={testing}
                className="rounded-[7px] border border-white/[0.12] bg-[#161616] px-4 py-2 font-mono text-xs text-[#a0a0a0] hover:text-white disabled:opacity-50">
                {testing ? 'Sending…' : 'Send test notification'}
              </button>
            </>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="self-end rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-5 py-2 font-mono text-xs text-[#ec4899] hover:bg-[rgba(236,72,153,0.2)] disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </section>
  );
}
