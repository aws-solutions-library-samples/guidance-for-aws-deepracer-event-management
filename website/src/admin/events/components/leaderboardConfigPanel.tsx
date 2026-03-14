import { FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from '../../../types/domain';
import { CarFleetPanel } from './carFleetPanel';

/**
 * Props for LeaderBoardConfigPanel component
 */
interface LeaderBoardConfigPanelProps {
  trackConfig: Track;
  onChange: (update: Partial<Track>) => void;
  onFormIsValid: () => void;
  onFormIsInvalid: () => void;
}

export const LeaderBoardConfigPanel: React.FC<LeaderBoardConfigPanelProps> = ({
  trackConfig,
  onChange,
  onFormIsValid,
  onFormIsInvalid,
}) => {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tempConfigtStore, setTempConfigStore] = useState<Track>({
    trackId: '',
    leaderBoardTitle: '',
    leaderBoardFooter: '',
  });

  const UpdateConfig = () => {
    const updatePayload: Partial<Track> = {
      trackId: trackConfig.trackId,
      leaderBoardTitle: tempConfigtStore.leaderBoardTitle,
      leaderBoardFooter: tempConfigtStore.leaderBoardFooter,
    };
    onChange(updatePayload);
  };

  useEffect(() => {
    setTempConfigStore(trackConfig);
  }, [trackConfig]);

  useEffect(() => {
    if (trackConfig.leaderBoardTitle) {
      setErrorMessage('');
      onFormIsValid();
    } else {
      setErrorMessage(t('events.leaderboard.validation-error-message'));
      onFormIsInvalid();
    }
  }, [trackConfig, onFormIsInvalid, onFormIsValid, t]);

  // JSX
  return (
    <SpaceBetween size="xl">
      <Header variant="h2">Track Settings</Header>
      <FormField
        label={t('events.leaderboard.header')}
        description={t('events.leaderboard.header-description')}
        errorText={errorMessage}
      >
        <Input
          onBlur={UpdateConfig}
          onChange={({ detail }) =>
            setTempConfigStore((prevValue) => {
              return { ...prevValue, leaderBoardTitle: detail.value };
            })
          }
          value={tempConfigtStore.leaderBoardTitle || ''}
        />
      </FormField>
      <FormField
        label={t('events.leaderboard.footer')}
        description={t('events.leaderboard.footer-description')}
      >
        <Input
          onBlur={UpdateConfig}
          onChange={({ detail }) =>
            setTempConfigStore((prevValue) => {
              return { ...prevValue, leaderBoardFooter: detail.value };
            })
          }
          value={tempConfigtStore.leaderBoardFooter || ''}
        />
      </FormField>

      {/* Car fleet is not used for the combined leaderboard */}
      {trackConfig.trackId.toString() !== 'combined' ? (
        <CarFleetPanel
          fleetId={trackConfig.fleetId || ''}
          onChange={(detail) => onChange({ trackId: trackConfig.trackId, fleetId: detail })}
        />
      ) : (
        <></>
      )}
    </SpaceBetween>
  );
};
