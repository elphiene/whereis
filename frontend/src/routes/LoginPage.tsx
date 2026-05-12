import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/shared/lib/traccar';

const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MELBOURNE: [number, number] = [144.9631, -37.8136];

function WhereLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 125 568 310"
      width="270"
      className="mx-auto block"
    >
      <text
        style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '94.3px', fontWeight: 800 }}
        transform="translate(63.43 262.72)"
      >
        <tspan fill="#ec4899" letterSpacing="-0.03em">W</tspan>
        <tspan fill="#231f20">here</tspan>
        <tspan fill="#ec4899">Is</tspan>
      </text>
      <rect fill="#231f20" x="394.56" y="382.46" width="44.89" height="44.89" />
      <path
        fill="#ec4899"
        d="M523.49,134.95H40.9c-22.59,0-40.9,18.31-40.9,40.9h0v101.05c24.79,0,44.89-20.1,44.89-44.89v-56.16h478.6v115.88h-88.03c-22.59,0-40.9,18.31-40.9,40.9v44.89h44.89v-44.89h88.03c22.59,0,40.9-18.31,40.9-40.9v-111.89c0-24.79-20.1-44.89-44.89-44.89Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, hydrate } = useAuthStore();

  // Already authenticated → skip login
  useEffect(() => {
    if (user) {
      navigate(searchParams.get('redirect') ?? '/map', { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Background map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: LIBERTY_STYLE,
      center: MELBOURNE,
      zoom: 13,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 401) {
        setError('Incorrect email or password');
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      await hydrate();
      navigate(searchParams.get('redirect') ?? '/map', { replace: true });
    } catch {
      setError('Could not reach the server. Check your connection.');
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* MapLibre background */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Dark overlay */}
      <div className="absolute inset-0 z-10 bg-black/55" />

      {/* Login card */}
      <div className="relative z-20 w-full max-w-[360px]">
        {/* Logo + subtitle */}
        <div className="mb-8 text-center">
          <WhereLogo />
          <p className="mt-3 font-mono text-[13px] text-[#a0a0a0]">
            private location network
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3.5">
            <label className="mb-1.5 block font-mono text-xs text-[#a0a0a0]">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/[0.12] bg-[#101010] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#888] focus:border-[rgba(236,72,153,0.3)]"
            />
          </div>

          <div className="mb-3.5">
            <label className="mb-1.5 block font-mono text-xs text-[#a0a0a0]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/[0.12] bg-[#101010] py-2.5 pl-3.5 pr-14 text-sm text-white outline-none transition-colors placeholder:text-[#888] focus:border-[rgba(236,72,153,0.3)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#888] transition-colors hover:text-white"
              >
                {showPassword ? 'hide' : 'show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg bg-[#ec4899] py-[11px] text-sm font-semibold text-white transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
