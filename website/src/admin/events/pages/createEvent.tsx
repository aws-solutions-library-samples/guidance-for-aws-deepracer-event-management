import { Button, Form, SpaceBetween } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';

import { EventInfoPanel } from '../components/generalInfoPanel';
import { RaceConfigPanel } from '../components/raceConfigPanel';
import { TracksPanel } from '../components/tracksPanel';
import { event } from '../support-functions/eventDomain';

export const CreateEvent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [send, loading, errorMessage, data] = useMutation() as any; // TODO: Type useMutation hook properly
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState<boolean>(false);
  const [eventConfig, setEventConfig] = useState(event);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

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
