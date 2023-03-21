import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';

import { merge } from '../../support-functions/merge';
import { CarFleetPanel } from './carFleetPanel';
import { event } from './eventDomain';
import { EventInfoPanel } from './generalInfoPanel';
import { RacePanel } from './racePanel';

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
    const user = await Auth.currentAuthenticatedUser();
    const payload = { ...eventConfig, createdBy: user.attributes.sub };
    send('addEvent', payload);
  };

  const formIsValidHandler = () => {
    setCreateButtonIsDisabled(false);
  };

  const formIsInvalidHandler = () => {
    setCreateButtonIsDisabled(true);
  };

  return (
    <>
      <PageLayout
        header={t('events.create-event')}
        description={t('events.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('events.breadcrumb'), href: '/admin/events' },
          { text: t('events.create-event') },
        ]}
      >
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
                {...eventConfig}
                onChange={UpdateConfigHandler}
                onFormIsValid={formIsValidHandler}
                onFormIsInvalid={formIsInvalidHandler}
              />
              <RacePanel
                tracks={eventConfig.tracks}
                onChange={UpdateConfigHandler}
                onFormIsValid={formIsValidHandler}
                onFormIsInvalid={formIsInvalidHandler}
              />
              <CarFleetPanel fleetId={eventConfig.fleetId} onChange={UpdateConfigHandler} />
            </SpaceBetween>
          </Form>
        </form>
      </PageLayout>
    </>
  );
};
