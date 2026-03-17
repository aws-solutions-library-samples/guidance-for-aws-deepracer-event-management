import { Container, FormField, Grid, Header, Toggle } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from '../../../hooks/useMutation';
import { RacesStatusEnum } from '../../../hooks/usePublishOverlay';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../../store/contexts/storeProvider';
import { RacerSelector } from '../components/racerSelector';
import { RacesDoneByUser } from '../components/racesDoneByUser';

interface Race {
  eventId?: string;
  trackId: string;
  trackName?: string;
  userId?: string;
  racedByProxy: boolean;
  [key: string]: any;
}

interface RaceSetupPageProps {
  race: Race;
  setRace: React.Dispatch<React.SetStateAction<Race>>;
}

interface RacerValidation {
  isInvalid: boolean;
  isDisabled: boolean;
}

export const RaceSetupPage: React.FC<RaceSetupPageProps> = ({ race, setRace }) => {
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

  const [racerValidation, setRacerValidation] = useState<RacerValidation>({
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
    if (!selectedEvent || !selectedTrack) return;
    
    setRace((preValue) => {
      return {
        ...preValue,
        eventId: selectedEvent.eventId,
        trackId: selectedTrack.trackId,
        trackName: selectedTrack.leaderBoardTitle,
      };
    });
  }, [selectedEvent, selectedTrack, setRace]);

  useEffect(() => {
    if (!selectedEvent?.eventId || !selectedTrack) return;

    const message = {
      eventId: selectedEvent.eventId,
      trackId: selectedTrack.trackId,
      raceStatus: RacesStatusEnum.NO_RACER_SELECTED,
    };
    SendMutation('updateOverlayInfo', message);
  }, [selectedEvent, SendMutation, selectedTrack]);

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

  const configUpdateHandler = (attr: Partial<Race>): void => {
    setRace((prevState) => {
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
          {`${selectedEvent?.eventName || ''} ${t('timekeeper.race-setup-page.racing-on-trackId')} ${
            selectedTrack?.leaderBoardTitle || ''
          } `}
        </Header>
      }
    >
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 3 }, { colspan: 3 }, { colspan: 12 }]}>
        <RacerSelector
          description={t('timekeeper.race-setup-page.racer-description')}
          race={race}
          onConfigUpdate={configUpdateHandler}
          racerValidation={racerValidation}
          selectedEvent={selectedEvent}
        />
        <RacesDoneByUser selecedEvent={(selectedEvent as any) || null} selecedUserId={race.userId || null} />
        <FormField
          label={t('race-admin.raced-by-proxy')}
          description={t('race-admin.raced-by-proxy-description')}
        >
          <Toggle
            checked={race.racedByProxy}
            onChange={(value) => configUpdateHandler({ racedByProxy: value.detail.checked })}
          />
        </FormField>
        {/* {actionButtons} */}
      </Grid>
    </Container>
  );
};
