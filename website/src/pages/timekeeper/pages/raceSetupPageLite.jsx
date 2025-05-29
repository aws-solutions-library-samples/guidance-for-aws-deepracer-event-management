import { Container, FormField, Grid, Header, Toggle } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from '../../../hooks/useMutation.js';
import { RacesStatusEnum } from '../../../hooks/usePublishOverlay.js';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../../store/contexts/storeProvider.js';
import { RacerSelector } from '../components/racerSelector.jsx';
import { RacesDoneByUser } from '../components/racesDoneByUser.jsx';

export const RaceSetupPage = (props) => {
  const { t } = useTranslation(['translation', 'help-admin-timekeeper-race-setup']);
  const [SendMutation] = useMutation();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  //const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  // const [race, setRace] = useState({
  //   eventId: selectedEvent.eventId,
  //   trackId: selectedTrack.trackId,
  //   userId: undefined,
  //   racedByProxy: false,
  // });

  const [racerValidation, setRacerValidation] = useState({
    isInvalid: true,
    isDisabled: false,
  });

  // // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  // useEffect(() => {
  //   if (selectedEvent.eventId == null) {
  //     setEventSelectModalVisible(true);
  //   }
  // }, [selectedEvent]);

  useEffect(() => {
    // update race setup when track or event is changed while on page
    props.setRace((preValue) => {
      return {
        ...preValue,
        eventId: selectedEvent.eventId,
        trackId: selectedTrack.trackId,
        trackName: selectedTrack.leaderBoardTitle,
      };
    });
  }, [selectedEvent, selectedTrack]);

  useEffect(() => {
    if (selectedEvent.eventId == null) return;

    const message = {
      eventId: selectedEvent.eventId,
      trackId: selectedTrack.trackId,
      raceStatus: RacesStatusEnum.NO_RACER_SELECTED,
    };
    SendMutation('updateOverlayInfo', message);
  }, [selectedEvent, SendMutation, selectedTrack.trackId]);

  // input validation
  useEffect(() => {
    if (props.race.eventId) {
      setRacerValidation((prevState) => {
        return { ...prevState, isDisabled: false };
      });
    }
    if (props.race.userId) {
      setRacerValidation((prevState) => {
        return { ...prevState, isInvalid: false };
      });
    }

    return () => {
      setRacerValidation({ isInvalid: true, isDisabled: true });
    };
  }, [props.race.eventId, props.race.userId]);

  const configUpdateHandler = (attr) => {
    props.setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  // const actionButtons = (
  //   <Box float="right">
  //     <SpaceBetween direction="horizontal" size="L">
  //       <Button variant="link">{t('button.cancel')}</Button>
  //       <Button
  //         variant="primary"
  //         disabled={racerValidation.isInvalid}
  //         onClick={() => {
  //           const raceDetails = {
  //             race: race,
  //             config: selectedEvent.raceConfig,
  //           };
  //           raceDetails.config['eventName'] = selectedEvent.eventName;
  //           raceDetails.race['eventId'] = selectedEvent.eventId;
  //           raceDetails.race['laps'] = [];
  //           console.log(raceDetails);
  //           onNext(raceDetails);
  //         }}
  //       >
  //         {t('button.next')}
  //       </Button>
  //     </SpaceBetween>
  //   </Box>
  // );

  return (
    <Container
      header={
        <Header>
          Race:{' '}
          {`${selectedEvent.eventName} ${t('timekeeper.race-setup-page.racing-on-trackId')} ${
            selectedTrack.leaderBoardTitle
          } `}
        </Header>
      }
    >
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 3 }, { colspan: 3 }, { colspan: 12 }]}>
        <RacerSelector
          description={t('timekeeper.race-setup-page.racer-description')}
          race={props.race}
          onConfigUpdate={configUpdateHandler}
          racerValidation={racerValidation}
          selectedEvent={selectedEvent}
        />
        <RacesDoneByUser selecedEvent={selectedEvent} selecedUserId={props.race.userId} />
        <FormField
          label={t('race-admin.raced-by-proxy')}
          description={t('race-admin.raced-by-proxy-description')}
        >
          <Toggle
            checked={props.race.racedByProxy}
            onChange={(value) => configUpdateHandler({ racedByProxy: value.detail.checked })}
          />
        </FormField>
        {/* {actionButtons} */}
      </Grid>
    </Container>
  );
};
