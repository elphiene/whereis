import { StepDots } from './StepDots';

interface WizardShellProps {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  error?: string | null;
  children: React.ReactNode;
}

export function WizardShell({
  step,
  totalSteps = 5,
  title,
  subtitle,
  error,
  children,
}: WizardShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] p-5">
      <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-[14px] border border-white/[0.12] bg-[#101010] p-6">
        <StepDots current={step} total={totalSteps} />

        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-0.5 font-mono text-xs text-[#a0a0a0]">{subtitle}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// Shared back/next button row used by most steps
export function WizardButtons({
  onBack,
  onNext,
  nextLabel = 'Next →',
  backLabel = '← Back',
  nextDisabled,
  loading,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 rounded-[7px] border border-white/[0.12] bg-transparent py-2 font-mono text-[12px] text-[#a0a0a0] transition-colors hover:border-white/20 hover:text-white"
      >
        {backLabel}
      </button>
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="flex-1 rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] py-2 font-mono text-[12px] text-[#ec4899] transition-colors hover:bg-[rgba(236,72,153,0.2)] disabled:opacity-50"
        >
          {loading ? '…' : nextLabel}
        </button>
      )}
    </div>
  );
}
