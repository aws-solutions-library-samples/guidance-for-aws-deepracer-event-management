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
import { SimpleHelpPanelLayout } from '../../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import { RacesStatusEnum } from '../../../hooks/usePublishOverlay';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../../store/contexts/storeProvider';
import { RacerSelector } from '../components/racerSelector';
import { RacesDoneByUser } from '../components/racesDoneByUser';
import { Breadcrumbs } from '../support-functions/supportFunctions';

interface RaceSetupPageProps {
  onNext: (raceDetails: any) => void;
}

interface RaceSetupState {
  eventId?: string;
  trackId?: string;
  trackName?: string;
  userId?: string;
  racedByProxy: boolean;
}

interface RacerValidation {
  isInvalid: boolean;
  isDisabled: boolean;
}

/**
 * RaceSetupPage component for setting up a new race
 * Handles racer selection and race configuration
 */
export const RaceSetupPage = ({ onNext }: RaceSetupPageProps): JSX.Element => {
  const { t } = useTranslation(['translation', 'help-admin-timekeeper-race-setup']);
  const [SendMutation] = useMutation();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);

  const [race, setRace] = useState<RaceSetupState>({
    eventId: selectedEvent?.eventId,
    trackId: selectedTrack?.trackId,
    trackName: selectedTrack?.leaderBoardTitle,
    userId: undefined,
    racedByProxy: false,
  });

  const [racerValidation, setRacerValidation] = useState<RacerValidation>({
    isInvalid: true,
    isDisabled: false,
  });

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent?.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  useEffect(() => {
    // update race setup when track or event is changed while on page
    setRace((preValue) => {
      return {
        ...preValue,
        eventId: selectedEvent?.eventId,
        trackId: selectedTrack?.trackId,
      };
    });
  }, [selectedEvent?.eventId, selectedTrack?.trackId]);

  useEffect(() => {
    if (selectedEvent?.eventId == null) return;

    const message = {
      eventId: selectedEvent.eventId,
      trackId: selectedTrack?.trackId || '',
      raceStatus: RacesStatusEnum.NO_RACER_SELECTED,
    };
    SendMutation('updateOverlayInfo' as any, message);
  }, [selectedEvent, SendMutation, selectedTrack?.trackId]);

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

  const configUpdateHandler = (attr: Partial<RaceSetupState>): void => {
    setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  const actionButtons = (
    <Box float="right">
      <SpaceBetween direction="horizontal" size="l">
        <Button variant="link">{t('button.cancel')}</Button>
        <Button
          variant="primary"
          disabled={racerValidation.isInvalid}
          onClick={() => {
            const raceDetails: any = {
              race: race,
              config: selectedEvent?.raceConfig,
            };
            raceDetails.config['eventName'] = selectedEvent?.eventName;
            raceDetails.race['eventId'] = selectedEvent?.eventId;
            raceDetails.race['laps'] = [];
            onNext(raceDetails);
          }}
        >
          {t('button.next')}
        </Button>
      </SpaceBetween>
    </Box>
  );

  const breadcrumbs = Breadcrumbs();
  return (
    <PageLayout
      helpPanelHidden={true}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-timekeeper-race-setup' })}
          bodyContent={t('content', { ns: 'help-admin-timekeeper-race-setup' })}
          footerContent={t('footer', { ns: 'help-admin-timekeeper-race-setup' })}
        />
      }
      breadcrumbs={breadcrumbs}
      header={t('timekeeper.race-setup-page.page-header')}
      description={t('timekeeper.race-setup-page.page-description')}
    >
      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />
      <SpaceBetween direction="vertical" size="l">
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
              selectedEvent={selectedEvent as any}
            />
            <RacesDoneByUser selecedEvent={selectedEvent as any} selecedUserId={race.userId || null} />
            <FormField
              label={t('race-admin.raced-by-proxy')}
              description={t('race-admin.raced-by-proxy-description')}
            >
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
