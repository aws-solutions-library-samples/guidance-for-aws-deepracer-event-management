import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import { useStore } from '../../../store/store';

import { EventInfoPanel } from '../components/generalInfoPanel';
import { RaceConfigPanel } from '../components/raceConfigPanel';
import { TracksPanel } from '../components/tracksPanel';
import { event } from '../support-functions/eventDomain';

export const CreateEvent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, dispatch] = useStore();

  const [send, loading, errorMessage, data] = useMutation() as any; // TODO: Type useMutation hook properly
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState<boolean>(false);
  const [eventConfig, setEventConfig] = useState(event);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      // Push the freshly-created event into the events store before
      // navigating back. The `onAddedEvent` AppSync subscription will
      // also deliver it shortly after — UPDATE_EVENT is upsert-safe so
      // the duplicate is harmless — but doing it eagerly here means the
      // event-selector dropdown shows it immediately rather than after
      // the round-trip.
      if (data?.eventId) {
        dispatch('UPDATE_EVENT', data);
      }
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate, dispatch]);

  const UpdateConfigHandler = (attr: any) => {
    console.debug(attr);
    setEventConfig((prevState) => {
      const merged = { ...prevState, ...attr };
      console.debug(merged);
      return merged;
    });
  };

  const onCreateEventHandler = async (): Promise<void> => {
    send('addEvent', eventConfig);
  };

  const formIsValidHandler = useCallback(() => {
    setCreateButtonIsDisabled(false);
  }, []);

  const formIsInvalidHandler = useCallback(() => {
    setCreateButtonIsDisabled(true);
  }, []);

  return (
    <PageLayout
      header={t('events.create-event')}
      description={t('events.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('events.breadcrumb'), href: '/admin/events' },
        { text: t('events.create-event'), href: '' },
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
            <RaceConfigPanel onChange={UpdateConfigHandler} raceConfig={eventConfig.raceConfig} />
            <TracksPanel
              tracks={eventConfig.tracks}
              onChange={UpdateConfigHandler}
              onFormIsValid={formIsValidHandler}
              onFormIsInvalid={formIsInvalidHandler}
            />
          </SpaceBetween>
        </Form>
      </form>
    </PageLayout>
  );
};
