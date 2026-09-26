import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { matchesQuery, searchItems } from '../utils/catalog';
import { useDebouncedValue } from '../utils/useDebouncedValue';

const SEARCH_DELAY_MS = 150;

// Text input that suggests catalog items as the user types. Picking one calls
// onPick(item); typing anything else is still allowed (onChange).
// `categoryFor(key)` returns { label, emoji } for a suggestion's category.
const ItemSearchInput = forwardRef(function ItemSearchInput(
  { items, categoryFor, value, onChange, onPick, className = '', ...inputProps },
  ref
) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = useDebouncedValue(value, SEARCH_DELAY_MS);
  const found = useMemo(() => searchItems(items, query), [items, query]);
  // The search runs on the debounced text, which trails the input. Drop any
  // result the current text no longer matches, so a replaced or pasted query
  // never shows stale suggestions while the new search is pending.
  const results = found.filter(item => matchesQuery(item, value));

  // Nothing left to suggest once the text is exactly the only match.
  const onlyExact = results.length === 1 && results[0].name.toLowerCase() === value.trim().toLowerCase();
  const showList = open && value.trim() !== '' && results.length > 0 && !onlyExact;

  // Inside a scrolling sheet the list can open below the visible area.
  const listRef = useRef(null);
  useEffect(() => {
    if (showList) listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [showList]);

  const pick = (item) => {
    onPick(item);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        className={`input-field ${className}`}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        {...inputProps}
      />
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto overscroll-contain bg-ink-800 border border-ink-700 rounded-lg shadow-lg py-1"
        >
          {results.map((item, i) => {
            const category = categoryFor(item.category);
            return (
              <li
                key={`${item.category}:${item.name}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the input so the tap is not lost to its blur.
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(item)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer text-sm touch-manipulation ${
                  i === active ? 'bg-ink-700 text-ink-100' : 'text-ink-200 hover:bg-ink-700/60'
                }`}
              >
                <span className="truncate">{item.name}</span>
                <span className="text-xs text-ink-500 shrink-0">
                  <span aria-hidden>{category.emoji}</span> <span className="hidden sm:inline">{category.label}</span>
                  <span className="sr-only sm:hidden">{category.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default ItemSearchInput;
