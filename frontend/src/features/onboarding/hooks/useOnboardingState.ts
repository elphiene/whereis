import { useState, useCallback } from 'react';

const LS_KEY = 'onboarding_state';

export interface OnboardingState {
  step: number;
  accountCreated: boolean;
  colourChosen: boolean;
  deviceConfigured: boolean;
  email: string;
  name: string;
  uuid: string | null;
  traccarUserId: number | null;
  traccarDeviceId: number | null;
  colour: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  accountCreated: false,
  colourChosen: false,
  deviceConfigured: false,
  email: '',
  name: '',
  uuid: null,
  traccarUserId: null,
  traccarDeviceId: null,
  colour: null,
};

function readState(): OnboardingState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(s: OnboardingState): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function clearOnboardingState(): void {
  localStorage.removeItem(LS_KEY);
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(readState);

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writeState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearOnboardingState();
    setState({ ...DEFAULT_STATE });
  }, []);

  return { state, update, reset };
}
