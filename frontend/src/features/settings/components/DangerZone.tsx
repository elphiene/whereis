import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';

export function DangerZone() {
  const navigate  = useNavigate();
  const clear     = useAuthStore((s) => s.clear);
  const [open,    setOpen]    = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleLeave() {
    setLeaving(true); setError(null);
    try {
      const res = await api('/backend/leave', { method: 'POST' });
      if (!res.ok) { setError('Failed to leave group. Please try again.'); setLeaving(false); return; }
      await api('/api/session', { method: 'DELETE' }).catch(() => {});
      clear();
      navigate('/left', { replace: true });
    } catch {
      setError('Network error. Please try again.');
      setLeaving(false);
    }
  }

  return (
    <section
      id="danger"
      className="rounded-[10px] border border-red-500/20 bg-red-500/[0.02]"
    >
      <div className="border-b border-red-500/[0.15] px-5 py-3.5 text-sm font-bold text-red-500">
        Danger Zone
      </div>
      <div className="flex flex-col gap-3 px-5 py-5">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
            {error}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-white">Leave Group</p>
          <p className="mt-0.5 font-mono text-xs text-[#a0a0a0]">
            Permanently removes your account and deletes all your data.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="self-start rounded-[7px] border border-red-500/30 bg-red-500/10 px-4 py-2 font-mono text-xs text-red-400 transition-colors hover:bg-red-500/20"
        >
          Leave Group
        </button>
      </div>

      {/* Confirmation dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-[340px] rounded-[14px] border border-white/[0.12] bg-[#101010] p-6">
            <h3 className="mb-4 text-base font-bold text-white">Leave Group?</h3>
            <div className="mb-4 flex flex-col gap-1.5">
              <p className="font-mono text-xs text-[#a0a0a0]">This will:</p>
              {[
                'Remove you from the group',
                'Delete your location history',
                'Stop your device from tracking',
                'Delete your account',
              ].map((line) => (
                <p key={line} className="font-mono text-xs text-[#a0a0a0]">· {line}</p>
              ))}
              <p className="mt-2 font-mono text-xs font-semibold text-white">This cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-[7px] border border-white/[0.12] py-2.5 font-mono text-xs text-[#a0a0a0] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 rounded-[7px] border border-red-500/30 bg-red-500/15 py-2.5 font-mono text-xs text-red-400 hover:bg-red-500/25 disabled:opacity-50"
              >
                {leaving ? 'Leaving…' : 'Leave Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
