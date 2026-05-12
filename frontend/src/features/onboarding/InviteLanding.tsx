import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

type ValidationResult =
  | { status: 'loading' }
  | { status: 'valid'; createdBy: number }
  | { status: 'invalid'; reason: string };

export function InviteLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [result, setResult] = useState<ValidationResult>({ status: 'loading' });

  const token = searchParams.get('token') ?? '';

  // If already authenticated, skip landing entirely
  useEffect(() => {
    if (user) navigate('/map', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!token) { setResult({ status: 'invalid', reason: 'No invite token provided.' }); return; }

    fetch(`/backend/invite/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (body.valid) {
          sessionStorage.setItem('invite_token', token);
          setResult({ status: 'valid', createdBy: body.createdBy });
        } else {
          setResult({
            status: 'invalid',
            reason:
              body.reason === 'used'
                ? 'This invite has already been used.'
                : body.reason === 'expired'
                  ? 'This invite has expired.'
                  : 'This invite link is invalid.',
          });
        }
      })
      .catch(() => setResult({ status: 'invalid', reason: 'Could not reach the server.' }));
  }, [token]);

  if (result.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080808]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ec4899] border-t-transparent" />
      </div>
    );
  }

  if (result.status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808] p-5">
        <div className="w-full max-w-[320px] rounded-[14px] border border-white/[0.12] bg-[#101010] p-6 text-center">
          <div className="mb-4 text-2xl">⚠️</div>
          <h2 className="mb-2 text-base font-bold text-white">{result.reason}</h2>
          <p className="font-mono text-xs text-[#a0a0a0]">
            Ask for a new invite from a group member.
          </p>
        </div>
      </div>
    );
  }

  // Valid invite
  const inviterInitial = String(result.createdBy).slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] p-5">
      <div className="flex w-full max-w-[320px] flex-col gap-5 rounded-[14px] border border-white/[0.12] bg-[#101010] p-6">
        {/* Inviter avatar + hero */}
        <div className="text-center">
          <div
            className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #9354d3, #6366f1)' }}
          >
            {inviterInitial}
          </div>
          <h2 className="text-base font-bold text-white">You've been invited!</h2>
          <p className="mt-1 font-mono text-xs text-[#a0a0a0]">
            Share your location with people you trust.
          </p>
        </div>

        <button
          onClick={() => navigate('/onboarding')}
          className="w-full rounded-lg bg-[#ec4899] py-[11px] text-sm font-semibold text-white transition-opacity hover:opacity-[0.88]"
        >
          Join WhereIs? →
        </button>

        <p className="text-center font-mono text-[11px] text-[#666]">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-[#ec4899] hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
