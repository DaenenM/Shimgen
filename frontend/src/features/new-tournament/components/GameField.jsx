import { useGameSuggestions } from '../hooks/useGameSuggestions'

// Game input with tap-to-fill suggestion chips ("lol" → League of Legends). Used by EntrantsPanel.jsx.
// Chips sit in the flow rather than a floating list, so nothing gets clipped by the glass panel.
export function GameField({ value, onChange }) {
  const suggestions = useGameSuggestions(value)

  return (
    <div className="flex w-full flex-col">
      <label className="flex w-full flex-col">
        <span className="label-text mb-1">
          Game <span className="text-base-content/40">(optional)</span>
        </span>
        <input
          type="text"
          maxLength={80}
          className="glass-inset focus:border-primary/50 placeholder:text-base-content/35 h-10 w-full px-3 text-sm transition-colors focus:outline-none"
          placeholder="Beer Pong, League of Legends…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      {suggestions.length > 0 && (
        <div className="menu-in mt-2 flex flex-wrap gap-1.5" aria-label="Game suggestions">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className="glass-inset hover:border-primary/40 hover:text-primary rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
