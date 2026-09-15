import { useEffect, useRef } from 'react';

// Short-lived confirmation with an optional action (e.g. Undo). Sits above the
// mobile bottom navigation. Remount (change `key`) to show a new toast; parent
// re-renders do not restart the timer.
export default function Toast({ message, actionLabel, onAction, onDismiss, duration = 5000 }) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-6 z-50 flex justify-center px-3 pointer-events-none" role="status" aria-live="polite">
      <div className="pointer-events-auto flex items-center gap-3 bg-ink-800 border border-ink-700 shadow-card rounded-xl pl-4 pr-2 py-2 max-w-sm w-full sm:w-auto fade-in">
        <span className="text-sm text-ink-100 flex-1">{message}</span>
        {actionLabel && (
          <button
            onClick={() => { onAction(); onDismiss(); }}
            className="text-sm font-semibold text-accent-light hover:text-white px-2 py-1.5 rounded-md touch-manipulation"
          >
            {actionLabel}
          </button>
        )}
        <button onClick={onDismiss} className="text-ink-500 hover:text-ink-300 p-1.5 touch-manipulation" aria-label="Dismiss">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
