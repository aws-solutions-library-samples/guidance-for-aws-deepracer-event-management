import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import useMutation from '../../hooks/useMutation';
import { LapTable } from './lapTable';

const EndSessionModal = ({ race, onSubmitRace, visible, onAction, onDismiss, onAbandonRace }) => {
  const { t } = useTranslation();
  const [message, SetMessage] = useState('');
  const [buttonsIsDisabled, SetButtonsIsDisabled] = useState(false);
  const [sendMutation, loading, errorMessage, data] = useMutation();

  const messageDisplayTime = 2500;

  // Update submit message in modal depending on addRace mutation result
  useEffect(() => {
    if (data && data.errors) {
      SetMessage(
        <span>
          <StatusIndicator type="error">{t('timekeeper.end-session.error')}</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        SetMessage('');
        SetButtonsIsDisabled(false);
      }, messageDisplayTime);
    } else {
      SetMessage(
        <span>
          <StatusIndicator type="info">{t('timekeeper.end-session.info')}</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        SetMessage('');
        SetButtonsIsDisabled(false);
        onSubmitRace();
      }, messageDisplayTime);
    }
  }, [data]);

  const submitRaceHandler = async () => {
    console.info('Submiting Race...');
    SetButtonsIsDisabled(true);
    sendMutation('addRace', { ...race });
  };

  const discardRaceHandler = () => {
    SetButtonsIsDisabled(true);
    SetMessage(
      <span>
        <StatusIndicator type="warning">{t('timekeeper.end-session.warning')}</StatusIndicator>
      </span>
    );
    setTimeout(() => {
      onAbandonRace();
      SetMessage('');
      SetButtonsIsDisabled(false);
    }, messageDisplayTime);
  };

  return (
    <Modal
      onDismiss={() => onDismiss()}
      visible={visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" disabled={buttonsIsDisabled} onClick={discardRaceHandler}>
              {t('timekeeper.end-session.discard-race')}
            </Button>
            <Button variant="primary" disabled={buttonsIsDisabled} onClick={submitRaceHandler}>
              {t('timekeeper.end-session.submit-race')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={t('timekeeper.end-session.header')}
    >
      {loading && (
        <span>
          {t('timekeeper.end-session.submitting-race')} <Spinner />
        </span>
      )}
      {!loading && message}
      {!loading && message.length === 0 && <LapTable laps={race.laps} onAction={onAction} />}
    </Modal>
  );
};

export { EndSessionModal };
