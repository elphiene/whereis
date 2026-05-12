import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Spinner }         from '@/shared/components/Spinner';
import { RequireAuth }     from '@/routes/RequireAuth';
import { LoginPage }       from '@/routes/LoginPage';
import { MapPage }         from '@/routes/MapPage';
import { SettingsPage }    from '@/routes/SettingsPage';
import { LeftPage }        from '@/routes/LeftPage';
import { HistoryPage }     from '@/features/history/HistoryPage';
import { StatsPage }       from '@/features/stats/StatsPage';
import { InviteLanding }   from '@/features/onboarding/InviteLanding';
import { Wizard }          from '@/features/onboarding/Wizard';
import { GeofencesPage }   from '@/features/geofences/GeofencesPage';

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

        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
