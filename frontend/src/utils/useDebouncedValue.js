import { useEffect, useState } from 'react';

// Returns `value` once it has stopped changing for `delay` ms, so work such as
// filtering suggestions runs after a pause in typing, not on every keystroke.
export function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
