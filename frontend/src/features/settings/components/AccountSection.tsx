import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-[#a0a0a0]">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { extraRight?: React.ReactNode }) {
  const { extraRight, ...rest } = props;
  return (
    <div className="relative">
      <input
        {...rest}
        className="w-full rounded-lg border border-white/[0.12] bg-[#161616] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#555] focus:border-[rgba(236,72,153,0.3)]"
        style={extraRight ? { paddingRight: '3.5rem' } : undefined}
      />
      {extraRight}
    </div>
  );
}

export function AccountSection() {
  const { user, hydrate } = useAuth();

  const [name,        setName]        = useState(user?.name ?? '');
  const [email,       setEmail]       = useState(user?.email ?? '');
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  const [toast,    setToast]    = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (user) { setName(user.name); setEmail(user.email); }
  }, [user?.id]);

  const emailChanged = email !== (user?.email ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw && newPw.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPw && newPw !== confirmPw) { setError('Passwords do not match'); return; }
    setError(null);
    setSaving(true);

    const body: Record<string, unknown> = { name, email };
    if (newPw) { body.password = newPw; body.oldPassword = currentPw; }

    try {
      const res = await fetch(`/api/users/${user!.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        setError(msg || 'Save failed. Please try again.');
      } else {
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        await hydrate();
        setToast('Changes saved');
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="account" className="rounded-[10px] border border-white/[0.07] bg-[#101010]">
      <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-bold">Account</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
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

        <FieldRow label="display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldRow>

        <FieldRow label="email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {emailChanged && (
            <p className="mt-1 font-mono text-[11px] text-amber-400">
              You'll use this to sign in next time
            </p>
          )}
        </FieldRow>

        <FieldRow label="current password">
          <Input
            type={showCurrent ? 'text' : 'password'}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
            extraRight={
              <button type="button" onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#666] hover:text-white">
                {showCurrent ? 'hide' : 'show'}
              </button>
            }
          />
        </FieldRow>

        <FieldRow label="new password (leave blank to keep)">
          <Input
            type={showNew ? 'text' : 'password'}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            extraRight={
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#666] hover:text-white">
                {showNew ? 'hide' : 'show'}
              </button>
            }
          />
        </FieldRow>

        <FieldRow label="confirm new password">
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
        </FieldRow>

        <button
          type="submit"
          disabled={saving || !name || !email}
          className="self-end rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-5 py-2 font-mono text-xs text-[#ec4899] transition-colors hover:bg-[rgba(236,72,153,0.2)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </section>
  );
}
