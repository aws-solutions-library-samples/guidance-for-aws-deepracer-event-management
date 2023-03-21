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
import { EventSelectorModal } from '../../components/eventSelectorModal';
import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';
import { RacesStatusEnum } from '../../hooks/usePublishOverlay';
import { eventContext } from '../../store/eventProvider';
import { usersContext } from '../../store/usersProvider';
import { breadcrumbs } from './supportFunctions';

export const RaceSetupPage = ({ onNext }) => {
  const { t } = useTranslation();
  const [SendMutation] = useMutation();
  const { events, selectedEvent } = useContext(eventContext);
  const [users, isLoadingRacers] = useContext(usersContext);
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  const [race, setRace] = useState({
    eventId: selectedEvent.eventId,
    trackId: 1,
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
    if (selectedEvent == null) return;

    const message = {
      eventId: selectedEvent.eventId,
      trackId: 1,
      raceStatus: RacesStatusEnum.NO_RACER_SELECTED,
    };
    SendMutation('updateOverlayInfo', message);
  }, [selectedEvent, SendMutation]);

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
  console.info(eventSelectModalVisible);
  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      header={t('timekeeper.race-setup-page.page-header') + `: ${selectedEvent.eventName}`}
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
