import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { WizardShell, WizardButtons } from './WizardShell';
import type { OnboardingState } from '../hooks/useOnboardingState';

const APP_STORE_URL = 'https://apps.apple.com/app/traccar-client/id843156974';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.traccar.client';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function useQR(url: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, { width: 120, color: { dark: '#ec4899', light: '#101010' }, margin: 2 })
      .then(setSrc)
      .catch(() => {});
  }, [url]);
  return src;
}

function StoreLink({ label, url, qrSrc }: { label: string; url: string; qrSrc: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {qrSrc && (
        <img src={qrSrc} alt={`QR for ${label}`} className="rounded-lg" width={90} height={90} />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-3 py-1.5 font-mono text-[11px] text-[#ec4899] transition-colors hover:bg-[rgba(236,72,153,0.2)]"
      >
        {label} ↗
      </a>
    </div>
  );
}

interface InstallStepProps {
  state: OnboardingState;
  onUpdate: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
  /** Re-onboarding mode: skip button instead of back/next */
  skipLabel?: string;
}

export function InstallStep({ state: _state, onUpdate, onNext, onBack, skipLabel }: InstallStepProps) {
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());
  const [showAll, setShowAll] = useState(platform === 'desktop');

  const iosQR = useQR(APP_STORE_URL);
  const androidQR = useQR(PLAY_STORE_URL);

  function handleNext() {
    onUpdate({ step: 4 });
    onNext();
  }

  const showIos = platform === 'ios' || showAll;
  const showAndroid = platform === 'android' || showAll;

  return (
    <WizardShell step={3} title="Install Traccar Client" subtitle="step 3 of 5">
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-[#a0a0a0]">
          Download the <strong className="text-white">Traccar Client</strong> app to share your
          location.
        </p>

        {/* Store links */}
        <div className={`flex gap-4 ${showAll ? 'justify-around' : 'justify-center'}`}>
          {showIos && <StoreLink label="App Store" url={APP_STORE_URL} qrSrc={iosQR} />}
          {showAndroid && <StoreLink label="Play Store" url={PLAY_STORE_URL} qrSrc={androidQR} />}
        </div>

        {!showAll && (
          <button
            type="button"
            onClick={() => { setPlatform('desktop'); setShowAll(true); }}
            className="font-mono text-[11px] text-[#666] hover:text-[#a0a0a0]"
          >
            Wrong platform? Show all options
          </button>
        )}
      </div>

      {skipLabel ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-[7px] border border-white/[0.12] bg-transparent py-2 font-mono text-[12px] text-[#a0a0a0] hover:text-white"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 rounded-[7px] border border-white/[0.12] bg-transparent py-2 font-mono text-[12px] text-[#a0a0a0] hover:text-white"
          >
            {skipLabel}
          </button>
        </div>
      ) : (
        <WizardButtons
          onBack={onBack}
          onNext={handleNext}
          nextLabel="I've installed it →"
        />
      )}
    </WizardShell>
  );
}
