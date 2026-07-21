import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@cloudscape-design/components/form-field';
import { resolveRacingColour } from '../support-functions/tailLightColour';
import { TAIL_LIGHT_COLOURS } from '../../../constants/tailLightColours';

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
  const { t } = useTranslation();
  const racingColour = resolveRacingColour(racerHighlightColour, override);
  const source = override
    ? t('timekeeper.taillight.source-override')
    : racerHighlightColour
      ? t('timekeeper.taillight.source-racer')
      : t('timekeeper.taillight.source-default');
  return (
    <FormField
      label={t('timekeeper.taillight.label')}
      description={t('timekeeper.taillight.description')}
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
            title={t('timekeeper.taillight.revert')}
            onClick={() => setOverride(null)}
            disabled={override === null}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '1px solid rgba(0,0,0,0.35)',
              background: 'transparent',
              padding: 0,
              fontSize: 14,
              lineHeight: '20px',
              cursor: override === null ? 'default' : 'pointer',
              // Revert is a no-op when no override is set — dim it rather than
              // render a filled (white-looking) "selected" swatch by default.
              opacity: override === null ? 0.4 : 1,
            }}
          >
            ✕
          </button>
          {TAIL_LIGHT_COLOURS.map((c) => (
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
