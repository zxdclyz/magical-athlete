import type { RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface Toast {
  id: number;
  racerName: RacerName;
  abilityName: string;
  description: string;
}

interface AbilityToastProps {
  toasts: Toast[];
}

export function AbilityToast({ toasts }: AbilityToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" role="status">
      {toasts.map((toast) => {
        const card = RACER_CARDS[toast.racerName];
        return (
          <div key={toast.id} className="ability-toast">
            <img
              src={getRacerImageUrl(toast.racerName)}
              alt={card?.displayNameCn ?? toast.racerName}
              className="toast-avatar"
              width={36}
              height={36}
            />
            <div className="toast-content">
              <div className="toast-title">{toast.abilityName}</div>
              <div className="toast-desc">{toast.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
