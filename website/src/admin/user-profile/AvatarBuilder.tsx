import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { AvatarDisplay } from '../../components/AvatarDisplay';
import { TAIL_LIGHT_COLOURS } from '../../constants/tailLightColours';
import { graphqlMutate, graphqlQuery } from '../../graphql/graphqlHelpers';
import { updateRacerProfile } from '../../graphql/mutations';
import { getRacerProfile } from '../../graphql/queries';
import { getCurrentAuthUser } from '../../hooks/useAuth';
import { useStore } from '../../store/store';

export interface AvatarConfig {
  topType: string;
  accessoriesType: string;
  hairColor: string;
  // '' = "match hair" (mapped to the nearest hat colour at render); otherwise a @vierweb hat colour.
  hatColor: string;
  facialHairType: string;
  facialHairColor: string;
  clotheType: string;
  clotheColor: string;
  eyeType: string;
  eyebrowType: string;
  mouthType: string;
  skinColor: string;
}

const DEFAULT_CONFIG: AvatarConfig = {
  topType: 'NoHair',
  accessoriesType: 'Blank',
  hairColor: 'Brown',
  hatColor: '',
  facialHairType: 'Blank',
  facialHairColor: 'Brown',
  clotheType: 'ShirtCrewNeck',
  clotheColor: 'Blue03',
  eyeType: 'Default',
  eyebrowType: 'Default',
  mouthType: 'Default',
  skinColor: 'Yellow',
};

// Options derived from @vierweb/avataaars supported values
const OPTIONS: Record<keyof AvatarConfig, string[]> = {
  topType: [
    'Helmet',
    'NoHair',
    'Eyepatch',
    'Hat',
    'Hijab',
    'Turban',
    'WinterHat1',
    'WinterHat2',
    'WinterHat3',
    'WinterHat4',
    'LongHairBigHair',
    'LongHairBob',
    'LongHairBun',
    'LongHairCurly',
    'LongHairCurvy',
    'LongHairDreads',
    'LongHairFrida',
    'LongHairFro',
    'LongHairFroBand',
    'LongHairNotTooLong',
    'LongHairShavedSides',
    'LongHairMiaWallace',
    'LongHairStraight',
    'LongHairStraight2',
    'LongHairStraightStrand',
    'ShortHairDreads01',
    'ShortHairDreads02',
    'ShortHairFrizzle',
    'ShortHairShaggyMullet',
    'ShortHairShortCurly',
    'ShortHairShortFlat',
    'ShortHairShortRound',
    'ShortHairShortWaved',
    'ShortHairSides',
    'ShortHairTheCaesar',
    'ShortHairTheCaesarSidePart',
  ],
  accessoriesType: [
    'Blank',
    'Kurt',
    'Prescription01',
    'Prescription02',
    'Round',
    'Sunglasses',
    'Wayfarers',
  ],
  hairColor: [
    'Auburn',
    'Black',
    'Blonde',
    'BlondeGolden',
    'Brown',
    'BrownDark',
    'PastelPink',
    'Platinum',
    'Red',
    'SilverGray',
  ],
  hatColor: [
    'Black',
    'Blue01',
    'Blue02',
    'Blue03',
    'Gray01',
    'Gray02',
    'Heather',
    'PastelBlue',
    'PastelGreen',
    'PastelOrange',
    'PastelRed',
    'PastelYellow',
    'Pink',
    'Red',
    'White',
  ],
  facialHairType: [
    'Blank',
    'BeardMedium',
    'BeardLight',
    'BeardMajestic',
    'MoustacheFancy',
    'MoustacheMagnum',
  ],
  facialHairColor: [
    'Auburn',
    'Black',
    'Blonde',
    'BlondeGolden',
    'Brown',
    'BrownDark',
    'Platinum',
    'Red',
  ],
  clotheType: [
    'BlazerShirt',
    'BlazerSweater',
    'CollarSweater',
    'GraphicShirt',
    'Hoodie',
    'Overall',
    'ShirtCrewNeck',
    'ShirtScoopNeck',
    'ShirtVNeck',
  ],
  clotheColor: [
    'Black',
    'Blue01',
    'Blue02',
    'Blue03',
    'Gray01',
    'Gray02',
    'Heather',
    'PastelBlue',
    'PastelGreen',
    'PastelOrange',
    'PastelRed',
    'PastelYellow',
    'Pink',
    'Red',
    'White',
  ],
  eyeType: [
    'Close',
    'Cry',
    'Default',
    'Dizzy',
    'EyeRoll',
    'Happy',
    'Hearts',
    'Side',
    'Squint',
    'Surprised',
    'Wink',
    'WinkWacky',
  ],
  eyebrowType: [
    'Angry',
    'AngryNatural',
    'Default',
    'DefaultNatural',
    'FlatNatural',
    'RaisedExcited',
    'RaisedExcitedNatural',
    'SadConcerned',
    'SadConcernedNatural',
    'UnibrowNatural',
    'UpDown',
    'UpDownNatural',
  ],
  mouthType: [
    'Concerned',
    'Default',
    'Disbelief',
    'Eating',
    'Grimace',
    'Sad',
    'ScreamOpen',
    'Serious',
    'Smile',
    'Tongue',
    'Twinkle',
    'Vomit',
  ],
  skinColor: ['Tanned', 'Yellow', 'Pale', 'Light', 'Brown', 'DarkBrown', 'Black'],
};

function toSelectOptions(values: string[]): SelectProps.Option[] {
  return values.map((v) => ({ value: v, label: v }));
}

interface AvatarBuilderProps {
  // no external props needed — reads/writes from RacerProfile table via AppSync
}

export const AvatarBuilder: React.FC<AvatarBuilderProps> = () => {
  const { t } = useTranslation();
  const [state, dispatch] = useStore();
  // Seed initial state from the userProfile store if TopNav has already
  // hydrated it on app load — gives an immediate paint with the correct
  // avatar instead of the default-yellow fallback while the fetch below
  // is in flight. The post-fetch setConfig still runs, so an out-of-date
  // store value gets corrected.
  const storeProfile = state.userProfile;
  const seededConfig = (() => {
    if (!storeProfile?.avatarConfig) return DEFAULT_CONFIG;
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(storeProfile.avatarConfig) };
    } catch {
      return DEFAULT_CONFIG;
    }
  })();
  const [config, setConfig] = useState<AvatarConfig>(seededConfig);
  const [highlightColour, setHighlightColour] = useState<string>(
    storeProfile?.highlightColour ?? ''
  );
  const [isConfigured, setIsConfigured] = useState<boolean>(!!storeProfile?.avatarConfig);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const authUser = await getCurrentAuthUser();
      const data = await graphqlQuery<{
        getRacerProfile: { avatarConfig?: string; highlightColour?: string } | null;
      }>(getRacerProfile, { username: authUser.username });
      const profile = data?.getRacerProfile;
      if (profile?.avatarConfig) {
        try {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(profile.avatarConfig) });
          setIsConfigured(true);
        } catch {
          // invalid JSON in profile — use defaults
        }
      }
      if (profile?.highlightColour) {
        setHighlightColour(profile.highlightColour);
      }
    };
    load();
  }, []);

  const set = (key: keyof AvatarConfig) => (e: { detail: SelectProps.ChangeDetail }) => {
    setConfig((prev) => ({ ...prev, [key]: e.detail.selectedOption.value ?? prev[key] }));
    setSaveMessage('');
  };

  const persistConfig = async (cfg: AvatarConfig) => {
    setSaving(true);
    try {
      const serialisedConfig = JSON.stringify(cfg);
      await graphqlMutate(updateRacerProfile, {
        input: {
          avatarConfig: serialisedConfig,
          highlightColour: highlightColour || null,
        },
      });
      setIsConfigured(true);
      setSaveMessage(t('avatar-builder.saved'));
      // Push into the shared store so the TopNav mini-avatar repaints
      // immediately rather than waiting for a page reload.
      dispatch('SET_USER_PROFILE', {
        avatarConfig: serialisedConfig,
        highlightColour: highlightColour || null,
      });
    } catch (err) {
      setSaveMessage(t('avatar-builder.save-error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => persistConfig(config);

  // "Reset to default racer" → the Stig helmet. Sets the Helmet sentinel top
  // (not a config wipe) so Stig also shows on the leaderboard, which renders
  // flag-only for genuinely unconfigured racers. Avatar only — the car
  // highlight colour is left untouched.
  const handleReset = () => {
    const resetConfig: AvatarConfig = { ...DEFAULT_CONFIG, topType: 'Helmet' };
    setConfig(resetConfig);
    persistConfig(resetConfig);
  };

  const selectFor = (key: keyof AvatarConfig, label: string) => (
    <FormField label={label}>
      <Select
        selectedOption={{ value: config[key], label: config[key] }}
        options={toSelectOptions(OPTIONS[key])}
        onChange={set(key)}
      />
    </FormField>
  );

  // hatColor needs an extra "match hair" option ('') — only meaningful for hat tops.
  const hatColorField = (
    <FormField label={t('avatar-builder.hat-color')}>
      <Select
        selectedOption={{
          value: config.hatColor,
          label: config.hatColor === '' ? t('avatar-builder.hat-color-auto') : config.hatColor,
        }}
        options={[
          { value: '', label: t('avatar-builder.hat-color-auto') },
          ...toSelectOptions(OPTIONS.hatColor),
        ]}
        onChange={set('hatColor')}
      />
    </FormField>
  );

  // Header with inline avatar preview (visible when collapsed)
  const headerContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <AvatarDisplay
        avatarConfig={isConfigured ? (config as unknown as Record<string, string>) : null}
        size={40}
      />
      <div>
        <Box variant="h2" padding="n">
          {t('avatar-builder.header')}
        </Box>
        <Box variant="small" color="text-body-secondary">
          {t('avatar-builder.description')}
        </Box>
      </div>
    </div>
  );

  return (
    <ExpandableSection variant="container" header={headerContent}>
      <SpaceBetween size="l">
        <ColumnLayout columns={2}>
          <div>
            <SpaceBetween size="m">
              {selectFor('topType', t('avatar-builder.top'))}
              {hatColorField}
              {selectFor('accessoriesType', t('avatar-builder.accessories'))}
              {selectFor('hairColor', t('avatar-builder.hair-color'))}
              {selectFor('facialHairType', t('avatar-builder.facial-hair'))}
              {selectFor('facialHairColor', t('avatar-builder.facial-hair-color'))}
              {selectFor('clotheType', t('avatar-builder.clothes'))}
              {selectFor('clotheColor', t('avatar-builder.clothes-color'))}
              {selectFor('eyeType', t('avatar-builder.eyes'))}
              {selectFor('eyebrowType', t('avatar-builder.eyebrows'))}
              {selectFor('mouthType', t('avatar-builder.mouth'))}
              {selectFor('skinColor', t('avatar-builder.skin'))}
            </SpaceBetween>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <AvatarDisplay avatarConfig={config as unknown as Record<string, string>} size={200} />
          </div>
        </ColumnLayout>
        <FormField label={t('avatar-builder.highlight-colour')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => {
                setHighlightColour('');
                setSaveMessage('');
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: '32px',
                boxShadow:
                  highlightColour === '' ? '0 0 0 3px #0972d3' : '0 0 0 1px rgba(0,0,0,0.3)',
                padding: 0,
              }}
              title="None"
            >
              ✕
            </button>
            {TAIL_LIGHT_COLOURS.map((colour) => (
              <button
                key={colour}
                onClick={() => {
                  setHighlightColour(colour);
                  setSaveMessage('');
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: colour,
                  cursor: 'pointer',
                  boxShadow:
                    highlightColour === colour ? '0 0 0 3px #0972d3' : '0 0 0 1px rgba(0,0,0,0.2)',
                  padding: 0,
                }}
                title={colour}
              />
            ))}
          </div>
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          {saveMessage && <Box variant="p">{saveMessage}</Box>}
          <Button onClick={handleReset} disabled={saving}>
            {t('avatar-builder.reset')}
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {t('avatar-builder.save')}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </ExpandableSection>
  );
};
