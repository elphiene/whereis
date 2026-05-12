import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';
import { getMemberStatus } from '@/features/friends/store';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

interface MemberRow {
  userId: number;
  traccarUserId: number;
  role: string;
  name: string;
  colour: string | null;
  lastPosition: { deviceId: number; speed: number; fixTime: string } | null;
}

interface InviteResult {
  url: string;
  expiresAt: number;
  expiryHours: number;
}

export function AdminSection() {
  const { user } = useAuthStore();
  const [expiryHours,    setExpiryHours]    = useState<24 | 168>(168);
  const [invite,         setInvite]         = useState<InviteResult | null>(null);
  const [generating,     setGenerating]     = useState(false);
  const [copiedInvite,   setCopiedInvite]   = useState(false);
  const [members,        setMembers]        = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [confirmRemove,  setConfirmRemove]  = useState<number | null>(null);
  const [removing,       setRemoving]       = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    setLoadingMembers(true);
    api('/backend/members')
      .then((r) => r.json())
      .then((data: MemberRow[]) => setMembers(data))
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, []);

  async function generateInvite() {
    setGenerating(true); setError(null);
    try {
      const res = await api('/backend/invites', {
        method: 'POST',
        body: JSON.stringify({ expiryHours }),
      });
      if (!res.ok) { setError('Failed to generate invite.'); return; }
      setInvite(await res.json());
    } catch { setError('Network error.'); }
    finally { setGenerating(false); }
  }

  async function removeMember(userId: number) {
    setRemoving(true);
    try {
      const res = await api(`/backend/members/${userId}`, { method: 'DELETE' });
      if (res.ok) setMembers((m) => m.filter((row) => row.userId !== userId));
      else setError('Remove failed.');
    } catch { setError('Network error.'); }
    finally { setRemoving(false); setConfirmRemove(null); }
  }

  return (
    <section id="admin" className="rounded-[10px] border border-white/[0.07] bg-[#101010]">
      <div className="border-b border-white/[0.07] px-5 py-3.5 text-sm font-bold">Admin</div>
      <div className="flex flex-col gap-5 px-5 py-5">
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">{error}</div>}

        {/* Invite */}
        <div>
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-[#666]">Invite Member</p>
          <p className="mb-2 font-mono text-xs text-[#a0a0a0]">Expires after</p>
          <div className="mb-3 flex gap-1.5">
            {([24, 168] as const).map((h) => (
              <button key={h} type="button" onClick={() => setExpiryHours(h)}
                className={`rounded-[7px] border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                  expiryHours === h
                    ? 'border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] text-[#ec4899]'
                    : 'border-white/[0.07] text-[#a0a0a0] hover:text-white'
                }`}>
                {h === 24 ? '24 hours' : '7 days'}
              </button>
            ))}
          </div>
          <button onClick={generateInvite} disabled={generating}
            className="rounded-[7px] border border-[rgba(236,72,153,0.3)] bg-[rgba(236,72,153,0.12)] px-4 py-2 font-mono text-xs text-[#ec4899] hover:bg-[rgba(236,72,153,0.2)] disabled:opacity-50">
            {generating ? 'Generating…' : 'Generate Invite Link'}
          </button>

          {invite && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-[#161616] px-3 py-2">
                <span className="flex-1 truncate font-mono text-[10px] text-[#a0a0a0]">{invite.url}</span>
                <button onClick={() => { navigator.clipboard.writeText(invite.url); setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000); }}
                  className="font-mono text-[11px] text-[#a0a0a0] hover:text-white">
                  {copiedInvite ? '✓' : '⎘'}
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#666]">
                Expires {new Date(invite.expiresAt * 1000).toLocaleDateString()} · Single use
              </p>
            </div>
          )}
        </div>

        {/* Member list */}
        <div>
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-widest text-[#666]">
            Members ({members.length})
          </p>
          {loadingMembers ? (
            <p className="font-mono text-xs text-[#666]">Loading…</p>
          ) : (
            <div className="flex flex-col">
              {members.map((m, i) => {
                const isOwn = m.userId === user?.id;
                const isAdmin = m.role === 'admin';
                const fakeLastUpdate = m.lastPosition?.fixTime ?? new Date(0).toISOString();
                const fakeMember = { deviceDisabled: false, lastUpdate: fakeLastUpdate, speed: m.lastPosition?.speed ?? 0 };
                const status = getMemberStatus(fakeMember);
                const initials = m.name.slice(0, 2).toUpperCase();
                return (
                  <div key={m.userId} className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: m.colour ? `linear-gradient(135deg, ${m.colour}, ${m.colour}88)` : 'linear-gradient(135deg, #9354d3, #6366f1)' }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        {m.name}
                        {isOwn && <span className="font-mono text-[10px] text-[#a0a0a0]">(you)</span>}
                        {isAdmin && <span>👑</span>}
                      </div>
                      <div className="font-mono text-[11px] text-[#a0a0a0]">
                        {status === 'offline' ? `⚠ Offline · ${relativeTime(fakeLastUpdate)}` : `● Online · ${relativeTime(fakeLastUpdate)}`}
                      </div>
                    </div>
                    {!isOwn && (
                      <button onClick={() => setConfirmRemove(m.userId)}
                        className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[11px] text-red-400 hover:bg-red-500/20">
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Remove confirmation dialog */}
        {confirmRemove != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="mx-4 w-full max-w-[320px] rounded-[14px] border border-white/[0.12] bg-[#101010] p-6">
              <h3 className="mb-3 text-base font-bold text-white">Remove member?</h3>
              <p className="mb-4 font-mono text-xs text-[#a0a0a0]">
                This will stop their device from tracking and remove them from the group.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRemove(null)}
                  className="flex-1 rounded-[7px] border border-white/[0.12] py-2 font-mono text-xs text-[#a0a0a0] hover:text-white">
                  Cancel
                </button>
                <button onClick={() => removeMember(confirmRemove)} disabled={removing}
                  className="flex-1 rounded-[7px] border border-red-500/30 bg-red-500/10 py-2 font-mono text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
