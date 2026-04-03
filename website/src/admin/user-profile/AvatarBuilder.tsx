import Avatar from 'avataaars';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import FormField from '@cloudscape-design/components/form-field';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { graphqlMutate } from '../../graphql/graphqlHelpers';
import * as mutations from '../../graphql/mutations';
import { getCurrentAuthUser, getCurrentUserAttributes } from '../../hooks/useAuth';

export interface AvatarConfig {
    topType: string;
    accessoriesType: string;
    hairColor: string;
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
    topType: 'ShortHairShortFlat',
    accessoriesType: 'Blank',
    hairColor: 'Brown',
    facialHairType: 'Blank',
    facialHairColor: 'Brown',
    clotheType: 'ShirtCrewNeck',
    clotheColor: 'Blue03',
    eyeType: 'Default',
    eyebrowType: 'Default',
    mouthType: 'Smile',
    skinColor: 'Light',
};

// Options derived from the avataaars library's supported values
const OPTIONS: Record<keyof AvatarConfig, string[]> = {
    topType: [
        'NoHair', 'Eyepatch', 'Hat', 'Hijab', 'Turban',
        'WinterHat1', 'WinterHat2', 'WinterHat3', 'WinterHat4',
        'LongHairBigHair', 'LongHairBob', 'LongHairBun', 'LongHairCurly',
        'LongHairCurvy', 'LongHairDreads', 'LongHairFrida', 'LongHairFro',
        'LongHairFroBand', 'LongHairNotTooLong', 'LongHairShavedSides',
        'LongHairMiaWallace', 'LongHairStraight', 'LongHairStraight2',
        'LongHairStraightStrand', 'ShortHairDreads01', 'ShortHairDreads02',
        'ShortHairFrizzle', 'ShortHairShaggyMullet', 'ShortHairShortCurly',
        'ShortHairShortFlat', 'ShortHairShortRound', 'ShortHairShortWaved',
        'ShortHairSides', 'ShortHairTheCaesar', 'ShortHairTheCaesarSidePart',
    ],
    accessoriesType: ['Blank', 'Kurt', 'Prescription01', 'Prescription02', 'Round', 'Sunglasses', 'Wayfarers'],
    hairColor: ['Auburn', 'Black', 'Blonde', 'BlondeGolden', 'Brown', 'BrownDark', 'PastelPink', 'Platinum', 'Red', 'SilverGray'],
    facialHairType: ['Blank', 'BeardMedium', 'BeardLight', 'BeardMajestic', 'MoustacheFancy', 'MoustacheMagnum'],
    facialHairColor: ['Auburn', 'Black', 'Blonde', 'BlondeGolden', 'Brown', 'BrownDark', 'Platinum', 'Red'],
    clotheType: ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'Overall', 'ShirtCrewNeck', 'ShirtScoopNeck', 'ShirtVNeck'],
    clotheColor: ['Black', 'Blue01', 'Blue02', 'Blue03', 'Gray01', 'Gray02', 'Heather', 'PastelBlue', 'PastelGreen', 'PastelOrange', 'PastelRed', 'PastelYellow', 'Pink', 'Red', 'White'],
    eyeType: ['Close', 'Cry', 'Default', 'Dizzy', 'EyeRoll', 'Happy', 'Hearts', 'Side', 'Squint', 'Surprised', 'Wink', 'WinkWacky'],
    eyebrowType: ['Angry', 'AngryNatural', 'Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'RaisedExcitedNatural', 'SadConcerned', 'SadConcernedNatural', 'UnibrowNatural', 'UpDown', 'UpDownNatural'],
    mouthType: ['Concerned', 'Default', 'Disbelief', 'Eating', 'Grimace', 'Sad', 'ScreamOpen', 'Serious', 'Smile', 'Tongue', 'Twinkle', 'Vomit'],
    skinColor: ['Tanned', 'Yellow', 'Pale', 'Light', 'Brown', 'DarkBrown', 'Black'],
};

function toSelectOptions(values: string[]): SelectProps.Option[] {
    return values.map((v) => ({ value: v, label: v }));
}

interface AvatarBuilderProps {
    // no external props needed — reads/writes its own Cognito attribute
}

// DeepRacer tail light colour palette (confirmed from car console)
const TAIL_LIGHT_COLOURS = [
    '#0000FF', '#1E8FFF', '#800080', '#673ab7', '#FF00FF', '#e91e63',
    '#FF0090', '#FF0000', '#FF8200', '#FFFF00', '#00FF00', '#417505', '#FFFFFF',
];

export const AvatarBuilder: React.FC<AvatarBuilderProps> = () => {
    const { t } = useTranslation();
    const [username, setUsername] = useState<string>('');
    const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
    const [highlightColour, setHighlightColour] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        const load = async () => {
            const [authUser, attrs] = await Promise.all([
                getCurrentAuthUser(),
                getCurrentUserAttributes(),
            ]);
            setUsername(authUser.username);
            const raw = attrs['custom:avatarConfig'];
            if (raw) {
                try {
                    setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
                } catch {
                    // invalid JSON in attribute — use defaults
                }
            }
            if (attrs['custom:highlightColour']) {
                setHighlightColour(attrs['custom:highlightColour']);
            }
        };
        load();
    }, []);

    const set = (key: keyof AvatarConfig) => (e: { detail: SelectProps.ChangeDetail }) => {
        setConfig((prev) => ({ ...prev, [key]: e.detail.selectedOption.value ?? prev[key] }));
        setSaveMessage('');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await graphqlMutate(mutations.updateUserProfile, {
                username,
                avatarConfig: JSON.stringify(config),
                highlightColour: highlightColour || null,
            });
            setSaveMessage(t('avatar-builder.saved'));
        } catch (err) {
            setSaveMessage(t('avatar-builder.save-error'));
        } finally {
            setSaving(false);
        }
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

    return (
        <ExpandableSection
            variant="container"
            headerText={t('avatar-builder.header')}
            headerDescription={t('avatar-builder.description')}
        >
            <SpaceBetween size="l">
                <ColumnLayout columns={2}>
                    <div>
                        <SpaceBetween size="m">
                            {selectFor('topType', t('avatar-builder.top'))}
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
                        <Avatar
                            avatarStyle="Circle"
                            style={{ width: 200, height: 200 }}
                            topType={config.topType}
                            accessoriesType={config.accessoriesType}
                            hairColor={config.hairColor}
                            facialHairType={config.facialHairType}
                            facialHairColor={config.facialHairColor}
                            clotheType={config.clotheType}
                            clotheColor={config.clotheColor}
                            eyeType={config.eyeType}
                            eyebrowType={config.eyebrowType}
                            mouthType={config.mouthType}
                            skinColor={config.skinColor}
                        />
                    </div>
                </ColumnLayout>
                <FormField label={t('avatar-builder.highlight-colour')}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <button
                            onClick={() => { setHighlightColour(''); setSaveMessage(''); }}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 18,
                                lineHeight: '32px',
                                boxShadow: highlightColour === '' ? '0 0 0 3px #0972d3' : '0 0 0 1px rgba(0,0,0,0.3)',
                                padding: 0,
                            }}
                            title="None"
                        >
                            ✕
                        </button>
                        {TAIL_LIGHT_COLOURS.map((colour) => (
                            <button
                                key={colour}
                                onClick={() => { setHighlightColour(colour); setSaveMessage(''); }}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: colour,
                                    cursor: 'pointer',
                                    boxShadow: highlightColour === colour
                                        ? '0 0 0 3px #0972d3'
                                        : '0 0 0 1px rgba(0,0,0,0.2)',
                                    padding: 0,
                                }}
                                title={colour}
                            />
                        ))}
                    </div>
                </FormField>
                <SpaceBetween direction="horizontal" size="xs">
                    {saveMessage && <Box variant="p">{saveMessage}</Box>}
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        {t('avatar-builder.save')}
                    </Button>
                </SpaceBetween>
            </SpaceBetween>
        </ExpandableSection>
    );
};
