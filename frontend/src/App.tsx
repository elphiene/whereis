import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { RequireAuth }    from '@/routes/RequireAuth';
import { LoginPage }      from '@/routes/LoginPage';
import { MapPage }        from '@/routes/MapPage';
import { HistoryPage }    from '@/routes/HistoryPage';
import { StatsPage }      from '@/routes/StatsPage';
import { SettingsPage }   from '@/routes/SettingsPage';
import { InviteLanding }  from '@/routes/InviteLanding';
import { LeftPage }       from '@/routes/LeftPage';
import { Wizard }            from '@/features/onboarding/Wizard';
import { GeofencesPage }    from '@/features/geofences/GeofencesPage';

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#080808]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#ec4899] border-t-transparent" />
    </div>
  );
}

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (loading) return <Spinner />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/invite"     element={<InviteLanding />} />
        <Route path="/onboarding" element={<Wizard />} />
        <Route path="/left"       element={<LeftPage />} />

        <Route path="/map"       element={<RequireAuth><MapPage /></RequireAuth>} />
        <Route path="/history"   element={<RequireAuth><HistoryPage /></RequireAuth>} />
        <Route path="/stats"     element={<RequireAuth><StatsPage /></RequireAuth>} />
        <Route path="/geofences" element={<RequireAuth><GeofencesPage /></RequireAuth>} />
        <Route path="/settings"  element={<RequireAuth><SettingsPage /></RequireAuth>} />

        {/* Default: send authenticated users to /map, unauthenticated to /login */}
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
