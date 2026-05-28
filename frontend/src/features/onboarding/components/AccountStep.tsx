import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardShell } from './WizardShell';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';
import type { OnboardingState } from '../hooks/useOnboardingState';

interface AccountStepProps {
  state: OnboardingState;
  onUpdate: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export function AccountStep({ state, onUpdate, onNext }: AccountStepProps) {
  const navigate = useNavigate();
  const hydrate = useAuthStore((s) => s.hydrate);

  const [name, setName] = useState(state.name || '');
  const [email, setEmail] = useState(state.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(null);
    setLoading(true);

    try {
      // 1. Create Traccar user account
      const userRes = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, administrator: false, disabled: false }),
      });

      if (userRes.status === 400) {
        const body = await userRes.json().catch(() => ({}));
        if (JSON.stringify(body).toLowerCase().includes('exist')) {
          setError('Account already exists — sign in instead →');
        } else {
          setError('Registration failed. Please check your details.');
        }
        setLoading(false);
        return;
      }
      if (!userRes.ok) {
        setError('Account creation failed. Please try again.');
        setLoading(false);
        return;
      }

      const traccarUser = await userRes.json();

      // 2. Log in with new credentials
      const sessionRes = await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!sessionRes.ok) {
        setError('Login after account creation failed. Please try signing in.');
        setLoading(false);
        return;
      }

      // 3. Generate device UUID and register with Traccar
      const uuid = crypto.randomUUID();
      const deviceRes = await api('/api/devices', {
        method: 'POST',
        body: JSON.stringify({ name: `${name}'s Device`, uniqueId: uuid }),
      });
      if (!deviceRes.ok) {
        setError('Device registration failed. Please retry.');
        setLoading(false);
        return;
      }
      const traccarDevice = await deviceRes.json();

      // 4. Register with backend (stores in SQLite, shares permissions, marks token used)
      const inviteToken = sessionStorage.getItem('invite_token');
      const regRes = await api('/backend/register', {
        method: 'POST',
        body: JSON.stringify({ inviteToken, uuid, traccarDeviceId: traccarDevice.id }),
      });
      if (!regRes.ok) {
        setError('Could not join the group. Please retry.');
        setLoading(false);
        return;
      }

      // 5. Persist to localStorage and auth store
      onUpdate({
        accountCreated: true,
        name,
        email,
        uuid,
        traccarUserId: traccarUser.id,
        traccarDeviceId: traccarDevice.id,
        step: 2,
      });
      await hydrate();
      onNext();
    } catch {
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardShell step={1} title="Create your account" subtitle="step 1 of 5" error={error}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
        <div>
          <label className="mb-1 block font-mono text-xs text-[#a0a0a0]">display name</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            className="w-full rounded-lg border border-white/[0.12] bg-[#161616] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#555] focus:border-[rgba(236,72,153,0.3)]"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs text-[#a0a0a0]">email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-lg border border-white/[0.12] bg-[#161616] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#555] focus:border-[rgba(236,72,153,0.3)]"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs text-[#a0a0a0]">password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/[0.12] bg-[#161616] py-2.5 pl-3.5 pr-12 text-sm text-white outline-none transition-colors placeholder:text-[#555] focus:border-[rgba(236,72,153,0.3)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#666] hover:text-white"
            >
              {showPassword ? 'hide' : 'show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name || !email || !password}
          className="mt-1 w-full rounded-lg bg-[#ec4899] py-[11px] text-sm font-semibold text-white transition-opacity hover:opacity-[0.88] disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create Account →'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate('/invite')}
        className="mt-1 text-center font-mono text-[11px] text-[#666] hover:text-[#a0a0a0]"
      >
        ← Back to invite
      </button>
    </WizardShell>
  );
}
