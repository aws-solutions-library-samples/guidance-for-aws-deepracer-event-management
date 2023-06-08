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
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../../../components/eventSelectorModal';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import { RacesStatusEnum } from '../../../hooks/usePublishOverlay';
import {
  useRacesContext,
  useSelectedEventContext,
  useSelectedTrackContext,
  useUsersContext,
} from '../../../store/storeProvider';
import { GetMaxRunsPerRacerFromId } from '../../events/support-functions/raceConfig';
import { breadcrumbs } from '../support-functions/supportFunctions';

export const RaceSetupPage = ({ onNext }) => {
  const { t } = useTranslation();
  const [SendMutation] = useMutation();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();
  const [users, isLoadingRacers] = useUsersContext();
  const [races, racesIsLoading] = useRacesContext();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  const [race, setRace] = useState({
    eventId: selectedEvent.eventId,
    trackId: selectedTrack.trackId,
    userId: undefined,
    racedByProxy: false,
  });

  const [racerValidation, setRacerValidation] = useState({
    isInvalid: true,
    isDisabled: false,
  });

  const [userOptions, SetUserOptions] = useState([]);

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  useEffect(() => {
    // update race setup when track or event is changed while on page
    setRace((preValue) => {
      return {
        ...preValue,
        eventId: selectedEvent.eventId,
        trackId: selectedTrack.trackId,
      };
    });
  }, [selectedEvent.eventId, selectedTrack.trackId]);

  useEffect(() => {
    if (selectedEvent == null) return;

    const message = {
      eventId: selectedEvent.eventId,
      trackId: selectedTrack.trackId,
      raceStatus: RacesStatusEnum.NO_RACER_SELECTED,
    };
    SendMutation('updateOverlayInfo', message);
  }, [selectedEvent, SendMutation, selectedTrack.trackId]);

  // input validation
  useEffect(() => {
    if (race.eventId) {
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
      setRacerValidation({ isInvalid: true, isDisabled: true });
    };
  }, [race.eventId, race.userId]);

  // Populate racer selection
  useEffect(() => {
    if (!isLoadingRacers && !racesIsLoading) {
      const maxRunsPerRacer = selectedEvent.raceConfig.maxRunsPerRacer;
      SetUserOptions(
        users.map((user) => {
          let option = { label: user.Username, value: user.sub };
          const numberOfRacesDoneByRacer = races.filter((race) => race.userId === user.sub);
          option.labelTag = `${numberOfRacesDoneByRacer.length}/${GetMaxRunsPerRacerFromId(
            maxRunsPerRacer
          )}`;

          // uncomment if user should be disabled if done the max allowed no races
          // if (numberOfRacesDoneByRacer.length >= maxRunsPerRacer) {
          //   option.disabled = true;
          // }
          return option;
        })
      );
    }
  }, [users, races, isLoadingRacers, racesIsLoading, selectedEvent]);

  const GetRacerOptionFromId = (id) => {
    if (!id) return;
    const selectedUser = userOptions.find((userOption) => userOption.value === id);
    if (selectedUser) return selectedUser;
    return undefined;
  };

  const configUpdateHandler = (attr) => {
    setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

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
          disabled={racerValidation.isInvalid}
          onClick={() => {
            const raceDetails = {
              race: race,
              config: selectedEvent.raceConfig,
            };
            raceDetails.config['eventName'] = selectedEvent.eventName;
            raceDetails.race['eventId'] = selectedEvent.eventId;
            raceDetails.race['laps'] = [];
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
      header={`${t('timekeeper.race-setup-page.page-header')}: ${selectedEvent.eventName} ${t(
        'timekeeper.race-setup-page.racing-on-trackId'
      )} ${selectedTrack.leaderBoardTitle} `}
      description={t('timekeeper.race-setup-page.page-description')}
    >
      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />
      <SpaceBetween direction="vertical" size="l">
        {racerSelectorPanel}
        {actionButtons}
      </SpaceBetween>
    </PageLayout>
  );
};
