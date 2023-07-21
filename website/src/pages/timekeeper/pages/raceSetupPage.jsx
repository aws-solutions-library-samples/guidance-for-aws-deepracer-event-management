import {
  Box,
  Button,
  Container,
  FormField,
  Grid,
  Header,
  SpaceBetween,
  Toggle,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../../../components/eventSelectorModal';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import { RacesStatusEnum } from '../../../hooks/usePublishOverlay';
import { useToolsOptionsDispatch } from '../../../store/appLayoutProvider';
import { useSelectedEventContext, useSelectedTrackContext } from '../../../store/storeProvider';
import { RacerSelector } from '../components/racerSelector.jsx';
import { RacesDoneByUser } from '../components/racesDoneByUser';
import { breadcrumbs } from '../support-functions/supportFunctions';

export const RaceSetupPage = ({ onNext }) => {
  const { t } = useTranslation();
  const [SendMutation] = useMutation();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

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

  // Help panel
  const toolsOptionsDispatch = useToolsOptionsDispatch();
  const helpPanelHidden = true;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        // content: (
        //   <SimpleHelpPanelLayout
        //     headerContent={t('header', { ns: 'help-admin-race-setup' })}
        //     bodyContent={t('content', { ns: 'help-admin-race-setup' })}
        //     footerContent={t('footer', { ns: 'help-admin-race-setup' })}
        //   />
        // ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

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

  const configUpdateHandler = (attr) => {
    setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

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
      helpPanelHidden={helpPanelHidden}
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
        <Container header={<Header>{t('timekeeper.racer-selector.racer-section-header')}</Header>}>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 3 }, { colspan: 3 }, { colspan: 12 }]}>
            <RacerSelector
              race={race}
              onConfigUpdate={configUpdateHandler}
              racerValidation={racerValidation}
              selectedEvent={selectedEvent}
            />
            <RacesDoneByUser selecedEvent={selectedEvent} selecedUserId={race.userId} />
            <FormField label={t('race-admin.raced-by-proxy')}>
              <Toggle
                checked={race.racedByProxy}
                onChange={(value) => configUpdateHandler({ racedByProxy: value.detail.checked })}
              />
            </FormField>
            {actionButtons}
          </Grid>
        </Container>
      </SpaceBetween>
    </PageLayout>
  );
};
