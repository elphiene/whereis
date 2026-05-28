import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { DatePresetChips, getDateRange, type DatePreset } from '@/shared/components/DatePresetChips';
import { useFriendsStore } from '@/features/friends/store';
import { Spinner } from '@/shared/components/Spinner';
import { api } from '@/shared/lib/traccar';

interface Summary {
  deviceId: number;
  distance: number;    // meters
  averageSpeed: number;
  maxSpeed: number;
  engineHours: number; // ms
  spentFuel: number;
}

interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  attributes: Record<string, unknown>;
}

interface DayDist { day: string; km: number }

interface MemberStats {
  userId: number;
  name: string;
  colour: string;
  summary: Summary | null;
  perDay: DayDist[];
  events: TraccarEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  overspeed: '⚡',
  geofenceEnter: '📍',
  geofenceExit: '📍',
  ignitionOn: '🔑',
  ignitionOff: '🔑',
};

function fmtDist(m: number) { return (m / 1000).toFixed(1) + ' km'; }
function fmtTime(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const CHART_TOOLTIP_STYLE = {
  background: '#101010', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 11,
};

export function StatsPage() {
  const members = useFriendsStore((s) => s.members);
  const [preset,   setPreset]   = useState<DatePreset>('7days');
  const [allStats, setAllStats] = useState<MemberStats[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [drillId,  setDrillId]  = useState<number | null>(null);

  useEffect(() => {
    if (!members.length) return;
    const { from, to } = getDateRange(preset);
    setLoading(true);

    Promise.all(
      members.map(async (m) => {
        const [summaryRes, tripsRes, eventsRes] = await Promise.all([
          api(`/api/reports/summary?deviceId=${m.traccarDeviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
          api(`/api/reports/trips?deviceId=${m.traccarDeviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
          api(`/api/reports/events?deviceId=${m.traccarDeviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        ]);

        const summaries: Summary[] = summaryRes.ok ? await summaryRes.json() : [];
        const summary = summaries.find((s) => s.deviceId === m.traccarDeviceId) ?? null;
        const trips: { startTime: string; distance: number }[] = tripsRes.ok ? await tripsRes.json() : [];
        const events: TraccarEvent[] = eventsRes.ok ? await eventsRes.json() : [];

        // Group trips by day
        const byDay: Record<string, number> = {};
        trips.forEach((t) => {
          const day = new Date(t.startTime).toLocaleDateString('en', { weekday: 'short' });
          byDay[day] = (byDay[day] ?? 0) + t.distance / 1000;
        });
        const perDay: DayDist[] = Object.entries(byDay).map(([day, km]) => ({ day, km: Math.round(km * 10) / 10 }));

        return { userId: m.userId, name: m.name, colour: m.colour, summary, perDay, events } as MemberStats;
      }),
    )
      .then((results) => {
        setAllStats(results.sort((a, b) => (b.summary?.distance ?? 0) - (a.summary?.distance ?? 0)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [preset, members]);

  const drillMember = allStats.find((s) => s.userId === drillId);
  const maxDist = Math.max(...allStats.map((s) => s.summary?.distance ?? 0), 1);

  // All events across all members, sorted by time desc
  const allEvents = allStats
    .flatMap((s) => s.events.map((e) => ({ ...e, memberName: s.name })))
    .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
    .slice(0, 20);

  return (
    <div className="min-h-screen overflow-y-auto bg-[#080808] px-6 py-7">
      {/* Header */}
      <div className="mx-auto mb-6 flex max-w-[900px] flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#666]">module</p>
          <h1 className="text-2xl font-bold text-white">{drillMember ? drillMember.name : 'Drive Stats'}</h1>
          <p className="mt-0.5 font-mono text-xs text-[#a0a0a0]">
            {drillMember ? 'per-driver breakdown' : 'group overview'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DatePresetChips value={preset} onChange={setPreset} />
          {drillMember && (
            <button onClick={() => setDrillId(null)}
              className="rounded-[7px] border border-white/[0.12] px-3 py-1.5 font-mono text-[11px] text-[#a0a0a0] hover:text-white">
              ← Group
            </button>
          )}
        </div>
      </div>

      {loading && (
        <Spinner />
      )}

      {!loading && (
        <div className="mx-auto max-w-[900px] space-y-6">
          {/* Drill-down view */}
          {drillMember ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Distance', value: fmtDist(drillMember.summary?.distance ?? 0), pink: true },
                  { label: 'Drive time', value: fmtTime(drillMember.summary?.engineHours ?? 0) },
                  { label: 'Trips', value: drillMember.perDay.length.toString() },
                  { label: 'Max speed', value: `${Math.round(drillMember.summary?.maxSpeed ?? 0)} km/h`, pink: true },
                ].map((c) => (
                  <div key={c.label} className="rounded-[10px] border border-white/[0.07] bg-[#101010] p-4">
                    <p className="mb-1 font-mono text-[11px] text-[#888]">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.pink ? 'text-[#ec4899]' : 'text-white'}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Distance chart */}
              {drillMember.perDay.length > 0 && (
                <div className="rounded-[10px] border border-white/[0.07] bg-[#101010] p-5">
                  <p className="mb-0.5 text-sm font-semibold text-white">Distance / day</p>
                  <p className="mb-3 font-mono text-[11px] text-[#888]">km</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={drillMember.perDay} barCategoryGap="30%">
                      <Bar dataKey="km" radius={[3, 3, 0, 0]}>
                        {drillMember.perDay.map((_, i) => (
                          <Cell key={i} fill={drillMember.colour} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => [`${v} km`, 'Distance']} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Events list */}
              {drillMember.events.length > 0 && (
                <div className="rounded-[10px] border border-white/[0.07] bg-[#101010] p-5">
                  <p className="mb-3 text-sm font-semibold text-white">Recent events</p>
                  <div className="flex flex-col gap-2">
                    {drillMember.events.slice(0, 10).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 border-t border-white/[0.07] pt-2">
                        <span className="text-[15px]">{EVENT_ICONS[ev.type] ?? '📌'}</span>
                        <div>
                          <p className="text-xs text-white">{ev.type.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="font-mono text-[10px] text-[#666]">
                            {new Date(ev.eventTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Leaderboard */}
              <div className="grid gap-3 sm:grid-cols-3">
                {allStats.map((s, idx) => {
                  const pct = ((s.summary?.distance ?? 0) / maxDist) * 100;
                  return (
                    <button key={s.userId} type="button" onClick={() => setDrillId(s.userId)}
                      className="flex flex-col gap-2 rounded-[10px] border bg-[#101010] p-4 text-left transition-colors hover:bg-[#151515]"
                      style={{ borderColor: idx === 0 ? `${s.colour}60` : 'rgba(255,255,255,0.07)', borderLeftWidth: idx === 0 ? 3 : 1, borderLeftColor: idx === 0 ? s.colour : undefined }}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${s.colour}, ${s.colour}88)` }}>
                          {s.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{s.name}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex justify-between">
                          <span className="font-mono text-[#888]">distance</span>
                          <span className="font-semibold text-[#ec4899]">{fmtDist(s.summary?.distance ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-mono text-[#888]">trips</span>
                          <span className="font-semibold text-white">{s.perDay.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-mono text-[#888]">max speed</span>
                          <span className="font-semibold text-white">{Math.round(s.summary?.maxSpeed ?? 0)} km/h</span>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/[0.07]">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: s.colour }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Charts row */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Group distance chart */}
                {allStats.some((s) => s.perDay.length > 0) && (
                  <div className="rounded-[10px] border border-white/[0.07] bg-[#101010] p-5">
                    <p className="mb-0.5 text-sm font-semibold text-white">Distance / day</p>
                    <p className="mb-3 font-mono text-[11px] text-[#888]">km · all drivers</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart
                        data={allStats[0]?.perDay.map((d) => ({
                          day: d.day,
                          ...Object.fromEntries(allStats.map((s) => [s.name, s.perDay.find((x) => x.day === d.day)?.km ?? 0])),
                        }))}
                        barCategoryGap="30%"
                      >
                        {allStats.map((s) => (
                          <Bar key={s.userId} dataKey={s.name} fill={s.colour} fillOpacity={0.8} radius={[2,2,0,0]} stackId="a" />
                        ))}
                        <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recent events */}
                <div className="rounded-[10px] border border-white/[0.07] bg-[#101010] p-5">
                  <p className="mb-0.5 text-sm font-semibold text-white">Recent events</p>
                  <p className="mb-3 font-mono text-[11px] text-[#888]">speed alerts &amp; geofences</p>
                  {allEvents.length === 0
                    ? <p className="font-mono text-xs text-[#666]">No events</p>
                    : (
                    <div className="flex flex-col gap-2">
                      {allEvents.slice(0, 8).map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5 border-t border-white/[0.07] pt-2">
                          <span className="text-[14px]">{EVENT_ICONS[ev.type] ?? '📌'}</span>
                          <div>
                            <p className="text-xs text-white">
                              <strong>{ev.memberName}</strong> · {ev.type.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                            </p>
                            <p className="font-mono text-[10px] text-[#666]">
                              {new Date(ev.eventTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
