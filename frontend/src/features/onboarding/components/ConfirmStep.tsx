import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from './WizardShell';
import { useDevicePoller } from '../hooks/useDevicePoller';
import { useFriendsStore } from '@/features/friends/store';
import type { OnboardingState } from '../hooks/useOnboardingState';

interface ConfirmStepProps {
  state: OnboardingState;
  onUpdate: (patch: Partial<OnboardingState>) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function ConfirmStep({ state, onUpdate, onComplete, onBack }: ConfirmStepProps) {
  const navigate = useNavigate();
  const members = useFriendsStore((s) => s.members);

  const [phase, setPhase] = useState<'waiting' | 'success' | 'help'>('waiting');

  const initials = (state.name || 'You').slice(0, 2).toUpperCase();
  const colour = state.colour ?? '#ec4899';

  const { pollerStatus, resetPoller } = useDevicePoller({
    traccarDeviceId: state.traccarDeviceId,
    enabled: phase === 'waiting',
    onSuccess: () => setPhase('success'),
    onTimeout: () => setPhase('help'),
  });

  // Auto-advance to map 3s after success
  useEffect(() => {
    if (phase !== 'success') return;
    onUpdate({ deviceConfigured: true });
    const t = setTimeout(() => { onComplete(); }, 3000);
    return () => clearTimeout(t);
  }, [phase, onUpdate, onComplete]);

  // Skip: mark incomplete and go to map
  function handleSkip() {
    onUpdate({ deviceConfigured: false });
    navigate('/map');
  }

  // Redo: go back to step 4
  function handleRedo() {
    onBack();
    resetPoller();
    setPhase('waiting');
  }

  if (phase === 'success') {
    return (
      <WizardShell step={5} title="✓ You're live!" subtitle="your location is now sharing">
        {/* Success avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative mx-auto h-16 w-16">
            <div className="absolute inset-[-5px] rounded-full border-2 border-[#22c55e] shadow-[0_0_14px_rgba(34,197,94,0.3)]" />
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${colour}, ${colour}88)` }}
            >
              {initials}
            </div>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-[#22c55e]">✓ You're live!</p>
            <p className="mt-1 font-mono text-xs text-[#a0a0a0]">
              your location is sharing
              {members.length > 1 && ` · ${members.length} members can see you`}
            </p>
          </div>
          <p className="font-mono text-[11px] text-[#666]">Heading to the map in a moment…</p>
          <button
            type="button"
            onClick={onComplete}
            className="w-full rounded-lg bg-[#ec4899] py-[11px] text-sm font-semibold text-white transition-opacity hover:opacity-[0.88]"
          >
            Go to Map →
          </button>
        </div>
      </WizardShell>
    );
  }

  if (phase === 'help') {
    return (
      <WizardShell step={5} title="Still waiting…" subtitle="most common fixes">
        <div className="flex flex-col gap-2">
          {[
            'Open Traccar Client — is it showing "Sending"?',
            'Allow location permission (set to "Always")',
            'Check the server URL is correct in the app settings',
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-[#161616] font-mono text-[10px] text-[#666]">
                {i + 1}
              </div>
              <p className="text-xs leading-relaxed text-[#a0a0a0]">{text}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRedo}
          className="w-full rounded-[7px] border border-white/[0.12] py-2 font-mono text-[12px] text-[#a0a0a0] hover:text-white"
        >
          ← Redo device setup
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="w-full font-mono text-[11px] text-[#666] hover:text-[#a0a0a0]"
        >
          Skip for now — I'll fix later
        </button>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      step={5}
      title="Waiting for your device…"
      subtitle="make sure Traccar Client is open and location is enabled"
    >
      {/* Pulse animation */}
      <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center">
        {[0, 0.7, 1.4].map((delay, i) => (
          <div
            key={i}
            className="absolute rounded-full border-[1.5px] border-[rgba(236,72,153,0.3)]"
            style={{
              animation: 'pulse-ring 2s ease-out infinite',
              animationDelay: `${delay}s`,
            }}
          />
        ))}
        <div
          className="relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${colour}, #9354d3)` }}
        >
          {initials}
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { width: 38px; height: 38px; opacity: 0.9; }
          100% { width: 72px; height: 72px; opacity: 0; }
        }
      `}</style>

      <p className="text-center font-mono text-[11px] text-[#666]">
        Checked {Math.min(pollerStatus === 'waiting' ? 0 : 0, 12)} / 12 — polling every 10s
      </p>

      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-[7px] border border-white/[0.12] py-2 font-mono text-[12px] text-[#a0a0a0] hover:text-white"
      >
        ← Back to device setup
      </button>
    </WizardShell>
  );
}
