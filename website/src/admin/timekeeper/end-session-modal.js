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
import { LapTable } from './lap-table';

const EndSessionModal = (props) => {
  const { t } = useTranslation();
  const [message, SetMessage] = useState('');
  const { send, loading, error } = useMutation('addRace');

  useEffect(() => {
    if (error) {
      SetMessage(
        <span>
          <StatusIndicator type="error">{t('timekeeper.end-session.error')}</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        SetMessage('');
      }, 3000);
    } else {
      SetMessage(
        <span>
          <StatusIndicator type="info">{t('timekeeper.end-session.info')}</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        props.onSubmitRace();
        SetMessage('');
      }, 3000);
    }
  }, [loading, error]);

  const submitRaceHandler = async () => {
    console.info('Submiting Race...');
    const lapsToSubmit = props.laps.map((lap) => {
      delete lap.id;
      return lap;
    });
    send({ eventId: props.selectedEvent.eventId, username: props.username, laps: lapsToSubmit });
  };

  const discardRaceHandler = () => {
    SetMessage(
      <span>
        <StatusIndicator type="warning">{t('timekeeper.end-session.warning')}</StatusIndicator>
      </span>
    );
    setTimeout(() => {
      props.onAbandonRace();
      SetMessage('');
    }, 3000);
  };

  return (
    <Modal
      onDismiss={() => props.onDismiss()}
      visible={props.visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" disabled={loading} onClick={discardRaceHandler}>
              {t('timekeeper.end-session.discard-race')}
            </Button>
            <Button variant="primary" disabled={loading} onClick={submitRaceHandler}>
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
      {!loading && message.length === 0 && <LapTable laps={props.laps} onAction={props.onAction} />}
    </Modal>
  );
};

export { EndSessionModal };
