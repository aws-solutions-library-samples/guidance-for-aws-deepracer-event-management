import React from 'react';
import FormField from '@cloudscape-design/components/form-field';
import { resolveRacingColour } from '../support-functions/tailLightColour';

// The colours racers can pick as their profile highlight (mirrors AvatarBuilder).
// Convenience swatches only — the backend now accepts any exact RGB.
const SWATCHES = [
  '#0000FF', '#1E8FFF', '#800080', '#673ab7', '#FF00FF', '#e91e63',
  '#FF0090', '#FF0000', '#FF8200', '#FFFF00', '#00FF00', '#417505', '#FFFFFF',
];

interface TailLightColourControlProps {
  racerHighlightColour?: string | null;
  override: string | null;
  setOverride: (colour: string | null) => void;
}

const dot = (colour: string, selected: boolean): React.CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: 'none',
  background: colour,
  cursor: 'pointer',
  padding: 0,
  boxShadow: selected ? '0 0 0 3px #0972d3' : '0 0 0 1px rgba(0,0,0,0.25)',
});

export const TailLightColourControl: React.FC<TailLightColourControlProps> = ({
  racerHighlightColour,
  override,
  setOverride,
}) => {
  const racingColour = resolveRacingColour(racerHighlightColour, override);
  const source = override ? 'override' : racerHighlightColour ? "racer's profile colour" : 'default (white)';
  return (
    <FormField
      label="Car tail-light colour"
      description="Sent to the assigned car when you continue. Defaults to the racer's profile colour — click a swatch to override, or ✕ to revert."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: racingColour,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            }}
          />
          <span style={{ fontSize: 13, opacity: 0.8 }}>{source}</span>
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            title="Use the racer's colour"
            onClick={() => setOverride(null)}
            style={{
              ...dot('transparent', override === null),
              fontSize: 14,
              lineHeight: '22px',
            }}
          >
            ✕
          </button>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setOverride(c)}
              style={dot(c, override === c)}
            />
          ))}
        </div>
      </div>
    </FormField>
  );
};
