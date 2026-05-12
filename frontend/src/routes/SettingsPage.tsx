import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { AccountSection }       from '@/features/settings/components/AccountSection';
import { AppearanceSection }    from '@/features/settings/components/AppearanceSection';
import { DeviceSection }        from '@/features/settings/components/DeviceSection';
import { NotificationsSection } from '@/features/settings/components/NotificationsSection';
import { AdminSection }         from '@/features/settings/components/AdminSection';
import { DangerZone }           from '@/features/settings/components/DangerZone';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center border-b border-white/[0.07] bg-[#080808] px-5 py-3.5">
        <Link
          to="/map"
          className="font-mono text-xs font-medium text-[#a0a0a0] transition-colors hover:text-white"
        >
          ← Back to map
        </Link>
        <span className="ml-auto text-sm font-bold">Settings</span>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[640px] px-6 py-7">
        <div className="flex flex-col gap-6">
          <AccountSection />
          <AppearanceSection />
          <DeviceSection />
          <NotificationsSection />
          {user?.role === 'admin' && <AdminSection />}
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
