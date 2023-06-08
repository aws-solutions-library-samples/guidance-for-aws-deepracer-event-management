import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import { EventInfoPanel } from '../components/generalInfoPanel';
import { RaceConfigPanel } from '../components/raceConfigPanel';
import { TracksPanel } from '../components/tracksPanel';
import { event } from '../support-functions/eventDomain';

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
      const merged = { ...prevState, ...attr };
      return merged;
    });
  };

  useEffect(() => {
    if (selectedEvent) {
      setEventConfig(selectedEvent);
    }
  }, [selectedEvent]);

  const onSaveEventHandler = async () => {
    delete eventConfig.raceConfig.eventName; // TODO delete after finding out where this comes from, causing eventName casue issue updating events sometimes!!!
    send('updateEvent', eventConfig);
  };

  const formIsValidHandler = useCallback(() => {
    setCreateButtonIsDisabled(false);
  }, []);

  const formIsInvalidHandler = useCallback(() => {
    setCreateButtonIsDisabled(true);
  }, []);

  console.info(eventConfig);
  return (
    <PageLayout
      header={t('events.edit-event')}
      description={t('events.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('events.breadcrumb'), href: '/admin/events' },
        { text: t('events.edit-event') },
      ]}
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate(-1)} disabled={loading}>
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={onSaveEventHandler}
                disabled={loading || createButtonIsDisabled}
              >
                {t('button.save')}
              </Button>
            </SpaceBetween>
          }
          errorText={errorMessage}
          errorIconAriaLabel="Error"
        >
          <SpaceBetween size="l">
            <EventInfoPanel
              sponsor={eventConfig.sponsor}
              typeOfEvent={eventConfig.typeOfEvent}
              countryCode={eventConfig.countryCode}
              eventDate={eventConfig.eventDate}
              eventName={eventConfig.eventName}
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
