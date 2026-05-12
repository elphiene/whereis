import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { WizardShell, WizardButtons } from './WizardShell';
import { SERVER_URL } from '@/shared/lib/traccar';
import type { OnboardingState } from '../hooks/useOnboardingState';

interface ConfigureStepProps {
  state: OnboardingState;
  onUpdate: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] text-[#666]">{label}</div>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={value}
          className="flex-1 rounded-[6px] border border-white/[0.12] bg-[#161616] px-2.5 py-1.5 font-mono text-[10px] text-[#a0a0a0]"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex-shrink-0 rounded-[5px] border border-white/[0.12] bg-[#161616] px-2 py-1.5 font-mono text-[11px] text-[#a0a0a0] hover:text-white"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>
    </div>
  );
}

export function ConfigureStep({ state, onUpdate, onNext, onBack }: ConfigureStepProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  const uuid = state.uuid ?? '';
  const serverApi = `${SERVER_URL}/api`;
  const deepLink = `traccar://connect?url=${encodeURIComponent(serverApi)}&id=${uuid}&period=60`;

  useEffect(() => {
    if (!uuid) return;
    QRCode.toDataURL(deepLink, {
      width: 160,
      color: { dark: '#ec4899', light: '#101010' },
      margin: 2,
    })
      .then(setQrSrc)
      .catch(() => {});
  }, [deepLink, uuid]);

  function handleNext() {
    onUpdate({ deviceConfigured: true, step: 5 });
    onNext();
  }

  return (
    <WizardShell step={4} title="Connect the app" subtitle="step 4 of 5">
      {/* Primary: deep link button */}
      <a
        href={deepLink}
        className="block w-full rounded-lg bg-[#ec4899] py-[11px] text-center text-sm font-semibold text-white transition-opacity hover:opacity-[0.88]"
      >
        Open in Traccar Client →
      </a>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="font-mono text-[11px] text-[#666]">or scan</span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      {/* QR code */}
      {qrSrc ? (
        <div className="flex justify-center">
          <img src={qrSrc} alt="Configuration QR code" className="rounded-lg" width={140} height={140} />
        </div>
      ) : (
        <div className="mx-auto flex h-[90px] w-[90px] items-center justify-center rounded-lg border border-white/[0.07] bg-[#161616] font-mono text-[10px] text-[#666]">
          loading…
        </div>
      )}

      {/* Manual accordion */}
      <div className="overflow-hidden rounded-lg border border-white/[0.07]">
        <button
          type="button"
          onClick={() => setAccordionOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 font-mono text-[11px] text-[#a0a0a0] hover:text-white"
        >
          <span>▼ need help? enter manually</span>
          <span>{accordionOpen ? '▲' : '▼'}</span>
        </button>
        {accordionOpen && (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-3 py-3">
            <CopyField label="server url" value={serverApi} />
            <CopyField label="device id" value={uuid} />
          </div>
        )}
      </div>

      <WizardButtons
        onBack={onBack}
        onNext={handleNext}
        nextLabel="I've connected →"
      />
    </WizardShell>
  );
}
