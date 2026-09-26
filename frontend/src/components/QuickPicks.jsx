// One-tap chips for the user's most-used items.
export default function QuickPicks({ picks, categoryFor, onPick }) {
  if (!picks.length) return null;
  return (
    <div>
      <p className="label">Quick add</p>
      <div className="flex flex-wrap gap-1.5">
        {picks.map(item => (
          <button
            key={`${item.category}:${item.name}`}
            type="button"
            onClick={() => onPick(item)}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium border border-ink-700 bg-ink-800/50 text-ink-300 hover:border-accent/60 hover:text-ink-100 transition-colors touch-manipulation"
          >
            <span aria-hidden>{categoryFor(item.category).emoji}</span> {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
