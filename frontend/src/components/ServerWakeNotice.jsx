import { useEffect, useState } from 'react';

// The API sleeps when idle (Render free tier) and takes up to a minute to
// boot. When a request is still pending after a few seconds, tell the user
// why instead of leaving them with a spinner that looks stuck.
export default function ServerWakeNotice({ active, delay = 5000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  if (!visible) return null;

  return (
    <p className="text-xs text-ink-400 text-center mt-3" role="status">
      The server is waking up after being idle. This can take up to a minute, please keep this page open.
    </p>
  );
}
