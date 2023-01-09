import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ContentHeader } from '../../components/ContentHeader';
import useMutation from '../../hooks/useMutation';
import { merge } from '../../support-functions/merge';
import { ConvertBeEventToFeEvent, ConvertFeEventToBeEvent, event } from './event-domain';
import { CarFleetPanel } from './fleet-panel';
import { EventInfoPanel } from './general-info-panel';
import { RacePanel } from './race-panel';

export const EditEvent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedEvent = location.state;
  const navigate = useNavigate();

  const [send, loading, errorMessage, data] = useMutation();
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState(false);
  const [eventConfig, setEventConfig] = useState(event);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

  const UpdateConfigHandler = (attr) => {
    setEventConfig((prevState) => {
      return merge({ ...prevState }, attr);
    });
  };

  useEffect(() => {
    if (selectedEvent) {
      setEventConfig(ConvertBeEventToFeEvent(selectedEvent));
    }
  }, [selectedEvent]);

  const onSaveEventHandler = async () => {
    send('updateEvent', ConvertFeEventToBeEvent(eventConfig));
  };

  const formIsValidHandler = () => {
    setCreateButtonIsDisabled(false);
  };

  const formIsInvalidHandler = () => {
    setCreateButtonIsDisabled(true);
  };

  return (
    <>
      <ContentHeader
        header={t('events.edit-event')}
        description={t('events.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('events.breadcrumb'), href: '/admin/events' },
          { text: t('events.edit-event') },
        ]}
      />
      <form onSubmit={(event) => event.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={onSaveEventHandler}
                disabled={loading || createButtonIsDisabled}
              >
                Save Changes
              </Button>
            </SpaceBetween>
          }
          errorText={errorMessage}
          errorIconAriaLabel="Error"
        >
          <SpaceBetween size="l">
            <EventInfoPanel
              {...eventConfig.generalConfig}
              onChange={UpdateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
            <RacePanel {...eventConfig.raceConfig} onChange={UpdateConfigHandler} />
            <CarFleetPanel {...eventConfig.fleetConfig} onChange={UpdateConfigHandler} />
          </SpaceBetween>
        </Form>
      </form>
    </>
  );
};
