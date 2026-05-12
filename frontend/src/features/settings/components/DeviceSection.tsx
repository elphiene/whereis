import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useFriendsStore, getMemberStatus } from '@/features/friends/store';
import { useMapStore } from '@/features/map/store';
import { SERVER_URL } from '@/shared/lib/traccar';
import { useOnboardingState } from '@/features/onboarding/hooks/useOnboardingState';
import { useDevicePoller } from '@/features/onboarding/hooks/useDevicePoller';
import QRCode from 'qrcode';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

type ReconnectStep = 'install' | 'configure' | 'confirm' | null;

function ReconnectFlow({ uuid, deviceId, colour, name, onDone }: {
  uuid: string;
  deviceId: number;
  colour: string;
  name: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'install' | 'configure' | 'confirm'>('install');
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [accordion, setAccordion] = useState(false);
  const [copied, setCopied] = useState<'server' | 'id' | null>(null);

  const serverApi = `${SERVER_URL}/api`;
  const deepLink = `traccar://connect?url=${encodeURIComponent(serverApi)}&id=${uuid}&period=60`;

  useEffect(() => {
    if (step !== 'configure') return;
    QRCode.toDataURL(deepLink, { width: 140, color: { dark: '#ec4899', light: '#101010' }, margin: 2 })
      .then(setQrSrc).catch(() => {});
  }, [step, deepLink]);

  function copyText(text: string, which: 'server' | 'id') {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const { pollerStatus } = useDevicePoller({
    traccarDeviceId: step === 'confirm' ? deviceId : null,
    enabled: step === 'confirm',
    onSuccess: onDone,
    onTimeout: () => {},
  });

  const initials = name.slice(0, 2).toUpperCase();

  if (step === 'install') {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-[#a0a0a0]">
          Download or open <strong className="text-white">Traccar Client</strong>.
        </p>
        <div className="flex gap-4">
          {['App Store', 'Play Store'].map((l) => (
            <a key={l} href={l === 'App Store'
              ? 'https://apps.apple.com/app/traccar-client/id843156974'
              : 'https://play.google.com/store/apps/details?id=org.traccar.client'}
              target="_blank" rel="noreferrer"
              className="rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-3 py-1.5 font-mono text-[11px] text-[#ec4899] hover:bg-[rgba(236,72,153,0.2)]">
              {l} ↗
            </a>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep('configure')}
            className="rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-4 py-2 font-mono text-xs text-[#ec4899] hover:bg-[rgba(236,72,153,0.2)]">
            I've installed it →
          </button>
          <button onClick={onDone}
            className="rounded-[7px] border border-white/[0.12] px-4 py-2 font-mono text-xs text-[#a0a0a0] hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'configure') {
    return (
      <div className="flex flex-col gap-3">
        <a href={deepLink}
          className="block rounded-lg bg-[#ec4899] py-2.5 text-center text-sm font-semibold text-white hover:opacity-90">
          Open in Traccar Client →
        </a>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.07]" />
          <span className="font-mono text-[11px] text-[#666]">or scan</span>
          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>
        {qrSrc && <img src={qrSrc} alt="QR" width={120} height={120} className="mx-auto rounded-lg" />}
        <div className="overflow-hidden rounded-lg border border-white/[0.07]">
          <button onClick={() => setAccordion((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] text-[#a0a0a0] hover:text-white">
            <span>▼ need help? enter manually</span>
          </button>
          {accordion && (
            <div className="flex flex-col gap-2 border-t border-white/[0.07] px-3 py-2">
              {[{ label: 'server url', value: serverApi, which: 'server' as const },
                { label: 'device id', value: uuid, which: 'id' as const }].map((f) => (
                <div key={f.label}>
                  <div className="mb-1 font-mono text-[10px] text-[#666]">{f.label}</div>
                  <div className="flex gap-1.5">
                    <input readOnly value={f.value}
                      className="flex-1 rounded border border-white/[0.12] bg-[#161616] px-2 py-1.5 font-mono text-[10px] text-[#a0a0a0]" />
                    <button onClick={() => copyText(f.value, f.which)}
                      className="rounded border border-white/[0.12] bg-[#161616] px-2 font-mono text-[11px] text-[#a0a0a0] hover:text-white">
                      {copied === f.which ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep('install')}
            className="flex-1 rounded-[7px] border border-white/[0.12] py-2 font-mono text-xs text-[#a0a0a0] hover:text-white">
            ← Back
          </button>
          <button onClick={() => setStep('confirm')}
            className="flex-1 rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] py-2 font-mono text-xs text-[#ec4899] hover:bg-[rgba(236,72,153,0.2)]">
            I've connected →
          </button>
        </div>
      </div>
    );
  }

  // confirm
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative flex h-[64px] w-[64px] items-center justify-center">
        {pollerStatus === 'success'
          ? (<>
              <div className="absolute inset-[-5px] rounded-full border-2 border-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.3)]" />
              <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${colour}, ${colour}88)` }}>
                {initials}
              </div>
            </>)
          : ([0, 0.7, 1.4].map((d, i) => (
              <div key={i} className="absolute rounded-full border-[1.5px] border-[rgba(236,72,153,0.3)]"
                style={{ animation: 'pulse-ring 2s ease-out infinite', animationDelay: `${d}s` }} />
            )))}
        {pollerStatus !== 'success' && (
          <div className="relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${colour}, #9354d3)` }}>
            {initials}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse-ring{0%{width:38px;height:38px;opacity:.9}100%{width:64px;height:64px;opacity:0}}`}</style>
      <p className="font-mono text-xs text-[#a0a0a0]">
        {pollerStatus === 'success' ? '✓ Device connected!' : 'Waiting for your device…'}
      </p>
      <button onClick={() => setStep('configure')}
        className="rounded-[7px] border border-white/[0.12] px-4 py-1.5 font-mono text-xs text-[#a0a0a0] hover:text-white">
        ← Back to setup
      </button>
    </div>
  );
}

export function DeviceSection() {
  const { user } = useAuthStore();
  const members = useFriendsStore((s) => s.members);
  const positions = useMapStore((s) => s.positions);
  const { state: onbState } = useOnboardingState();

  const [reconnectStep, setReconnectStep] = useState<ReconnectStep>(null);

  const own = members.find((m) => m.userId === user?.id);
  const ownPos = own ? positions[own.userId] : null;
  const status = own ? getMemberStatus(own) : null;

  const statusLabel =
    status === 'moving'     ? '● Online'
    : status === 'paused'   ? '⏸ Paused'
    : status === 'offline'  ? '⚠ Offline'
    : status === 'stationary' ? '● Online'
    : '—';

  const statusColor =
    status === 'offline' || status === 'paused' ? '#a0a0a0' : '#22c55e';

  return (
    <section id="device" className="rounded-[10px] border border-white/[0.07] bg-[#101010]">
      <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-bold">
        Device &amp; Tracking
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">
        {reconnectStep ? (
          <ReconnectFlow
            uuid={onbState.uuid ?? ''}
            deviceId={onbState.traccarDeviceId ?? 0}
            colour={user?.colour ?? '#ec4899'}
            name={user?.name ?? 'You'}
            onDone={() => setReconnectStep(null)}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              <Row label="Status">
                <span style={{ color: statusColor }} className="font-mono text-xs">{statusLabel}</span>
              </Row>
              {own && (
                <Row label="Last seen">
                  <span className="font-mono text-xs text-white">{relativeTime(own.lastUpdate)}</span>
                </Row>
              )}
              {ownPos?.battery != null && (
                <Row label="Battery">
                  <span className="font-mono text-xs text-white">🔋 {ownPos.battery}%</span>
                </Row>
              )}
              <Row label="Tracking frequency">
                <span className="font-mono text-xs text-[#a0a0a0]">60s (fixed)</span>
              </Row>
            </div>

            <div>
              <button
                onClick={() => setReconnectStep('install')}
                className="rounded-[7px] border border-white/[0.12] bg-[#161616] px-4 py-2 font-mono text-xs text-[#a0a0a0] transition-colors hover:border-white/20 hover:text-white"
              >
                Reconnect Device
              </button>
              <p className="mt-1.5 font-mono text-[11px] text-[#666]">
                Use this if you switched phones or reinstalled Traccar Client.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
    </div>
  );
}
