export const COLOUR_PALETTE = [
  '#E05C5C', // red
  '#E08A5C', // orange
  '#D4B84A', // yellow
  '#5CB85C', // green
  '#5C9ED4', // blue
  '#8A6FD4', // purple
  '#D45CA0', // pink
  '#5CD4C0', // teal
];

interface ColourPickerProps {
  palette?: string[];
  occupied: string[];
  value: string | null;
  onChange: (colour: string) => void;
  name: string;
}

export function ColourPicker({
  palette = COLOUR_PALETTE,
  occupied,
  value,
  onChange,
  name,
}: ColourPickerProps) {
  const initials = name.slice(0, 2).toUpperCase() || '?';
  const displayColour = value ?? palette[0] ?? '#ec4899';

  return (
    <div className="flex items-center gap-3">
      {/* Preview avatar */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          background: `linear-gradient(135deg, ${displayColour}, ${displayColour}88)`,
          border: `2px solid ${displayColour}`,
        }}
      >
        {initials}
      </div>

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {palette.map((colour) => {
          const isOccupied = occupied.includes(colour);
          const isSelected = colour === value;
          return (
            <button
              key={colour}
              type="button"
              onClick={() => { if (!isOccupied) onChange(colour); }}
              disabled={isOccupied}
              title={isOccupied ? 'Taken' : colour}
              className={`h-[26px] w-[26px] rounded-full transition-transform ${
                isSelected
                  ? 'scale-[1.25] ring-2 ring-white ring-offset-1 ring-offset-[#101010]'
                  : isOccupied
                    ? 'cursor-not-allowed opacity-20'
                    : 'hover:scale-110'
              }`}
              style={{ background: colour }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Returns the first colour in the palette not present in occupied[]. */
export function autoAssignColour(occupied: string[]): string {
  return (
    COLOUR_PALETTE.find((c) => !occupied.includes(c)) ?? COLOUR_PALETTE[0]
  );
}
