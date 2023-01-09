import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ContentHeader } from '../../components/ContentHeader';
import useMutation from '../../hooks/useMutation';

import { merge } from '../../support-functions/merge';
import { ConvertFeEventToBeEvent, event } from './event-domain';
import { CarFleetPanel } from './fleet-panel';
import { EventInfoPanel } from './general-info-panel';
import { RacePanel } from './race-panel';

export const CreateEvent = () => {
  const { t } = useTranslation();
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

  const onCreateEventHandler = async () => {
    send('addEvent', ConvertFeEventToBeEvent(eventConfig));
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
        header={t('events.create-event')}
        description={t('events.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('events.breadcrumb'), href: '/admin/events' },
          { text: t('events.create-event') },
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
                onClick={onCreateEventHandler}
                disabled={loading || createButtonIsDisabled}
              >
                Create Event
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
