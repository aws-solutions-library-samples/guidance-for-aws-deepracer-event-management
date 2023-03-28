import {
  Container,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetQrCodeOptionFromBoolean, qrCodeIsVisibleoptions } from './leaderboardConfig';

export const LeaderBoardConfigPanel = ({
  footerText,
  headerText,
  qrCodeVisible,
  sponsor,
  onChange,
  onFormIsValid,
  onFormIsInvalid,
}) => {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState();

  const UpdateConfig = (attr) => {
    onChange({ leaderboardConfig: { ...attr } });
  };
  // console.info(GetQrCodeOptionFromBoolean(qrCodeVisible));
  useEffect(() => {
    if (headerText) {
      setErrorMessage('');
      onFormIsValid();
    } else {
      setErrorMessage(t('events.leaderboard.validation-error-message'));
      onFormIsInvalid();
    }
  }, [headerText, onFormIsInvalid, onFormIsValid]);

  // JSX
  return (
    <Container header={<Header variant="h2">Leaderboard settings</Header>}>
      <SpaceBetween size="xl">
        <FormField
          label={t('events.leaderboard.header')}
          description={t('events.leaderboard.header-description')}
          errorText={errorMessage}
        >
          <Input
            onChange={({ detail }) => UpdateConfig({ headerText: detail.value })}
            value={headerText}
          />
        </FormField>
        <FormField
          label={t('events.leaderboard.footer')}
          description={t('events.leaderboard.footer-description')}
        >
          <Input
            onChange={({ detail }) => UpdateConfig({ footerText: detail.value })}
            value={footerText}
          />
        </FormField>
        <FormField
          label={t('events.leaderboard.sponsor')}
          description={t('events.leaderboard.sponsor-description')}
        >
          <Input
            onChange={({ detail }) => UpdateConfig({ sponsor: detail.value })}
            value={sponsor}
          />
        </FormField>
        <FormField
          label={t('events.leaderboard.qr-code-header')}
          description={t('events.leaderboard.qr-code-description')}
        >
          <Select
            selectedOption={GetQrCodeOptionFromBoolean(qrCodeVisible)}
            onChange={({ detail }) => UpdateConfig({ qrCodeVisible: detail.selectedOption.value })}
            options={qrCodeIsVisibleoptions()}
            selectedAriaLabel="Selected"
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
