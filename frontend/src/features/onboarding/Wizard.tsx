import { useNavigate } from 'react-router-dom';
import { useOnboardingState } from './hooks/useOnboardingState';
import { AccountStep }  from './components/AccountStep';
import { ColourStep }   from './components/ColourStep';
import { InstallStep }  from './components/InstallStep';
import { ConfigureStep } from './components/ConfigureStep';
import { ConfirmStep }  from './components/ConfirmStep';

export function Wizard() {
  const navigate = useNavigate();
  const { state, update, reset } = useOnboardingState();

  const step = state.step || 1;

  function goTo(n: number) { update({ step: n }); }

  function handleComplete() {
    reset();
    navigate('/map', { replace: true });
  }

  // Step 1 — account creation
  if (step === 1) {
    return (
      <AccountStep
        state={state}
        onUpdate={update}
        onNext={() => goTo(2)}
      />
    );
  }

  // Step 2 — colour picker
  if (step === 2) {
    return (
      <ColourStep
        state={state}
        onUpdate={update}
        onNext={() => goTo(3)}
        onBack={() => goTo(1)}
      />
    );
  }

  // Step 3 — install Traccar Client
  if (step === 3) {
    return (
      <InstallStep
        state={state}
        onUpdate={update}
        onNext={() => goTo(4)}
        onBack={() => goTo(2)}
      />
    );
  }

  // Step 4 — configure app
  if (step === 4) {
    return (
      <ConfigureStep
        state={state}
        onUpdate={update}
        onNext={() => goTo(5)}
        onBack={() => goTo(3)}
      />
    );
  }

  // Step 5 — confirm device reporting
  return (
    <ConfirmStep
      state={state}
      onUpdate={update}
      onComplete={handleComplete}
      onBack={() => goTo(4)}
    />
  );
}
