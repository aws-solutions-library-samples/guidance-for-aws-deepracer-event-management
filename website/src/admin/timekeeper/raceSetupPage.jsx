import {
  Box,
  Button,
  Container,
  FormField,
  Grid,
  Header,
  Select,
  SpaceBetween,
  Toggle,
} from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import { eventContext } from '../../store/eventProvider';
import { usersContext } from '../../store/usersProvider';
import { breadcrumbs } from './supportFunctions';

export const RaceSetupPage = ({ onNext }) => {
  const { t } = useTranslation();
  const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);
  const [users, isLoadingRacers] = useContext(usersContext);

  const [race, setRace] = useState({
    eventId: selectedEvent.eventId,
    trackId: 1,
    userId: undefined,
    racedByProxy: false,
  });

  const [eventValidation, setEventValidation] = useState({
    isInvalid: true,
    isLoading: false,
  });

  const [racerValidation, setRacerValidation] = useState({
    isInvalid: true,
    isDisabled: true,
  });

  const [userOptions, SetUserOptions] = useState([]);

  // input validation
  useEffect(() => {
    if (race.eventId) {
      setEventValidation((prevState) => {
        return { ...prevState, isInvalid: false };
      });
      setRacerValidation((prevState) => {
        return { ...prevState, isDisabled: false };
      });
    }
    if (race.userId) {
      setRacerValidation((prevState) => {
        return { ...prevState, isInvalid: false };
      });
    }

    return () => {
      setEventValidation((prevState) => {
        return { ...prevState, isInvalid: true };
      });
      setRacerValidation({ isInvalid: true, isDisabled: true });
    };
  }, [race.eventId, race.userId]);

  // Populate racer selection
  useEffect(() => {
    if (users) {
      SetUserOptions(
        users.map((user) => {
          return { label: user.Username, value: user.sub };
        })
      );
    }
  }, [users]);

  const GetRacerOptionFromId = (id) => {
    if (!id) return;
    const selectedUser = userOptions.find((userOption) => userOption.value === id);
    if (selectedUser) return selectedUser;
    return undefined;
  };

  const configUpdateHandler = (attr) => {
    if (attr.eventId) {
      const event = events.find((event) => event.eventId === attr.eventId);
      setSelectedEvent(event);
    }

    //onRaceChange(attr);
    setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  const GetEventOptionFromId = (id) => {
    if (!id) return;

    const selectedEvent = events.find((event) => event.eventId === id);
    if (selectedEvent) {
      return { label: selectedEvent.eventName, value: selectedEvent.eventId };
    }
    return undefined;
  };

  const eventSelector = (
    <Container header={<Header>{t('timekeeper.racer-selector.event-section-header')}</Header>}>
      <Grid gridDefinition={[{ colspan: 7 }, { colspan: 3 }]}>
        <FormField label={t('timekeeper.racer-selector.select-event')}>
          <Select
            selectedOption={GetEventOptionFromId(race.eventId)}
            onChange={(detail) => {
              configUpdateHandler({ eventId: detail.detail.selectedOption.value });
            }}
            options={events.map((event) => {
              return { label: event.eventName, value: event.eventId };
            })}
            selectedAriaLabel={t('timekeeper.racer-selector.selected')}
            filteringType="auto"
            virtualScroll
            invalid={eventValidation.isInvalid}
            loadingText={t('timekeeper.racer-selector.loading-events')}
            statusType={eventValidation.isLoading ? t('timekeeper.racer-selector.loading') : ''}
          />
        </FormField>
        <FormField label={t('timekeeper.racer-selector.select-track')}>
          <Select
            selectedOption={{ label: race.trackId, value: race.trackId }}
            onChange={(detail) => {
              configUpdateHandler({ trackId: detail.detail.selectedOption.value });
            }}
            options={selectedEvent.tracks.map((track) => {
              return { label: track.trackId, value: track.trackId };
            })}
            selectedAriaLabel={t('timekeeper.racer-selector.selected')}
            filteringType="auto"
            virtualScroll
            invalid={eventValidation.isInvalid}
            loadingText={t('timekeeper.racer-selector.loading-events')}
            statusType={eventValidation.isLoading ? t('timekeeper.racer-selector.loading') : ''}
          />
        </FormField>
      </Grid>
    </Container>
  );

  const racerSelectorPanel = (
    <Container header={<Header>{t('timekeeper.racer-selector.racer-section-header')}</Header>}>
      <Grid gridDefinition={[{ colspan: 7 }, { colspan: 3 }]}>
        <FormField label={t('timekeeper.racer-selector.select-racer')}>
          <Select
            selectedOption={GetRacerOptionFromId(race.userId)}
            onChange={({ detail }) =>
              configUpdateHandler({
                userId: detail.selectedOption.value,
                username: detail.selectedOption.label,
              })
            }
            options={userOptions}
            selectedAriaLabel={t('timekeeper.racer-selector.selected')}
            filteringType="auto"
            virtualScroll
            invalid={racerValidation.isInvalid}
            disabled={racerValidation.isDisabled}
            loadingText={t('timekeeper.racer-selector.loading-racers')}
            statusType={isLoadingRacers ? t('timekeeper.racer-selector.loading') : ''}
          />
        </FormField>
        <FormField label={t('race-admin.raced-by-proxy')}>
          <Toggle
            checked={race.racedByProxy}
            onChange={(value) => configUpdateHandler({ racedByProxy: value.detail.checked })}
          />
        </FormField>
      </Grid>
    </Container>
  );

  const actionButtons = (
    <Box float="right">
      <SpaceBetween direction="horizontal" size="L">
        <Button variant="link">{t('button.cancel')}</Button>
        <Button
          variant="primary"
          disabled={eventValidation.isInvalid || racerValidation.isInvalid}
          onClick={() => {
            const raceDetails = {
              race: race,
              config: selectedEvent.tracks[race.trackId - 1].raceConfig,
            };
            raceDetails.config['eventName'] = selectedEvent.eventName;
            onNext(raceDetails);
          }}
        >
          {t('button.next')}
        </Button>
      </SpaceBetween>
    </Box>
  );

  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      header={t('timekeeper.race-setup-page.page-header')}
      description={t('timekeeper.race-setup-page.page-description')}
    >
      <SpaceBetween direction="vertical" size="l">
        {eventSelector}
        {racerSelectorPanel}
        {actionButtons}
      </SpaceBetween>
    </PageLayout>
  );
};
