import { useEffect, useState } from 'react';
import { WizardShell, WizardButtons } from './WizardShell';
import { ColourPicker, autoAssignColour } from '@/shared/components/ColourPicker';
import type { OnboardingState } from '../hooks/useOnboardingState';

interface ColourStepProps {
  state: OnboardingState;
  onUpdate: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ColourStep({ state, onUpdate, onNext, onBack }: ColourStepProps) {
  const [occupied, setOccupied] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(state.colour ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/backend/colours', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { colour_hex: string }[]) => {
        const taken = data.map((d) => d.colour_hex);
        setOccupied(taken);
        if (!selected) setSelected(autoAssignColour(taken));
      })
      .catch(() => {});
  }, []);

  async function handleNext() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/backend/users/me/colour', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colour: selected }),
      });
      if (!res.ok) { setError('Could not save colour. Retry.'); setSaving(false); return; }
      onUpdate({ colour: selected, colourChosen: true, step: 3 });
      onNext();
    } catch {
      setError('Network error. Retry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell step={2} title="Choose your colour" subtitle="how you appear on the map" error={error}>
      <ColourPicker
        occupied={occupied}
        value={selected}
        onChange={setSelected}
        name={state.name || 'You'}
      />
      <p className="font-mono text-[11px] text-[#666]">occupied colours are greyed out</p>
      <WizardButtons
        onBack={onBack}
        onNext={handleNext}
        nextLabel="Next →"
        nextDisabled={!selected}
        loading={saving}
      />
    </WizardShell>
  );
}
