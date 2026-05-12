import { useEffect, useState } from 'react';
import { ColourPicker, autoAssignColour } from '@/shared/components/ColourPicker';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';

export function AppearanceSection() {
  const { user } = useAuthStore();
  const setUser = useAuthStore((s) => s.hydrate);

  const [occupied,   setOccupied]   = useState<string[]>([]);
  const [selected,   setSelected]   = useState<string | null>(user?.colour ?? null);
  const [saved,      setSaved]      = useState<string | null>(user?.colour ?? null);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    api('/backend/colours')
      .then((r) => r.json())
      .then((data: { user_id: number; colour_hex: string }[]) => {
        // Exclude own colour from occupied list so user can re-select same colour
        const taken = data
          .filter((d) => d.user_id !== user?.id)
          .map((d) => d.colour_hex);
        setOccupied(taken);
        if (!selected) setSelected(autoAssignColour(taken));
      })
      .catch(() => {});
  }, [user?.id]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    // Optimistic
    setSaved(selected);
    try {
      const res = await api('/backend/users/me/colour', {
        method: 'PATCH',
        body: JSON.stringify({ colour: selected }),
      });
      if (!res.ok) {
        setSelected(saved); // revert
        setError('Could not save colour.');
      } else {
        await setUser();
        setToast('Colour saved');
        setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setSelected(saved);
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="appearance" className="rounded-[10px] border border-white/[0.07] bg-[#101010]">
      <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-bold">Appearance</div>
      <div className="flex flex-col gap-4 px-5 py-5">
        {toast && (
          <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-3 py-2 font-mono text-xs text-[#22c55e]">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
            {error}
          </div>
        )}

        <div>
          <p className="mb-1 font-mono text-xs font-medium text-white">Your colour</p>
          <p className="mb-3 font-mono text-[11px] text-[#a0a0a0]">
            How you appear on everyone's map
          </p>
          <ColourPicker
            occupied={occupied}
            value={selected}
            onChange={setSelected}
            name={user?.name ?? 'You'}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selected || selected === saved}
          className="self-end rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-5 py-2 font-mono text-xs text-[#ec4899] transition-colors hover:bg-[rgba(236,72,153,0.2)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Colour'}
        </button>
      </div>
    </section>
  );
}
