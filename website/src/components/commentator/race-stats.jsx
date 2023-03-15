import ColumnLayout from '@cloudscape-design/components/column-layout';
import { API, graphqlOperation } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLeaderboard, getRaces } from '../../graphql/queries';
import { onNewOverlayInfo } from '../../graphql/subscriptions';
import { eventContext } from '../../store/eventProvider';
import { PageLayout } from '../pageLayout';

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';

import { Box, SpaceBetween, Table } from '@cloudscape-design/components';
import { RaceTimeAsString } from '../raceTimeAsString';

const CommenatorRaceStats = () => {
  const { t } = useTranslation();
  const [subscription, SetSubscription] = useState();

  const { selectedEvent } = useContext(eventContext);
  const [actualRacer, SetActualRacer] = useState('No active Racer');

  const [fastesRacerTime, SetFastesRacerTime] = useState({});
  const [slowestRacerTime, SetSlowestRacerTime] = useState({});

  const [fastesLapsForTrack, SetFastestLapsForTrack] = useState([]);
  const [slowestLapsForTrack, SetSlowestLapsForTrack] = useState([]);

  useEffect(() => {
    if (selectedEvent) {
      const loadLeaderboard = async () => {
        const eventId = selectedEvent.eventId;

        const response = await API.graphql(
          graphqlOperation(getLeaderboard, { eventId: eventId, trackId: 1 })
        );
        const leaderboard = response.data.getLeaderboard;
        console.info(response.data.getLeaderboard);

        SetFastestLapsForTrack(
          leaderboard.entries > 5 ? leaderboard.entries.slice(5) : leaderboard.entries
        );
        SetSlowestLapsForTrack(
          leaderboard.entries > 5
            ? leaderboard.entries.slice(-5).reverse()
            : leaderboard.entries.slice().reverse()
        );
      };

      loadLeaderboard();
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (actualRacer && selectedEvent) {
      console.info('Load data for ' + actualRacer);

      // not working properly at the moment because of the missing userId in the overlay Update
      const loadUserLaps = async () => {
        const eventId = selectedEvent.eventId;
        const userId = actualRacer.userId;

        const response = await API.graphql(
          graphqlOperation(getRaces, { eventId: eventId, userId: userId })
        );
        console.info(response);
        const laps = response.data.getRaces.flatMap((race) => race.laps);
        console.info(laps);

        const lapsSorted = laps
          .filter((lap) => lap.isValid === true)
          .sort((a, b) => a.time > b.time);
        console.info(lapsSorted);

        SetFastesRacerTime(lapsSorted[0]);
        SetSlowestRacerTime(lapsSorted.pop());
      };

      loadUserLaps();
    }
  }, [actualRacer, selectedEvent]);

  useEffect(() => {
    if (selectedEvent) {
      if (subscription) {
        subscription.unsubscribe();
      }

      const eventId = selectedEvent.eventId;
      console.info(eventId);

      SetSubscription(
        API.graphql(graphqlOperation(onNewOverlayInfo, { eventId: eventId })).subscribe({
          next: (event) => {
            const eventData = event.value.data.onNewOverlayInfo;
            if (eventData.username !== actualRacer) SetActualRacer(eventData);
          },
          error: (error) => console.warn(error),
        })
      );

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [selectedEvent]);

  const ValueWithLabel = ({ label, children }) => (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );

  const columnDefinitions = [
    {
      id: 'time',
      header: 'time',
      cell: (item) => <RaceTimeAsString timeInMS={item.fastestLapTime}></RaceTimeAsString>,
    },
    {
      id: 'racerName',
      header: 'Racer Name',
      cell: (item) => item.username || '-',
    },
    {
      id: 'numberOfValidLaps',
      header: 'Valid Laps',
      cell: (item) => item.numberOfValidLaps || '-',
    },
    {
      id: 'avgLapsPerAttempt',
      header: 'Average Laps',
      cell: (item) => item.avgLapsPerAttempt || '-',
    },
  ];

  return (
    <>
      <PageLayout
        header={t('commentator.race.header')}
        description={t('commentator.race.stats')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('commentator.breadcrumb') },
          { text: t('commentator.race.breadcrumb'), href: '/' },
        ]}
      >
        <SpaceBetween size="l">
          <Container
            header={
              <Header variant="h2" description={t('commentator.race.actualRacerStats')}>
                Actual Racer
              </Header>
            }
          >
            <ColumnLayout columns={3}>
              <ValueWithLabel label={t('commentator.race.racerName')}>
                {actualRacer.username}
              </ValueWithLabel>
              <ValueWithLabel label={t('commentator.race.racerFastestLap')}>
                <RaceTimeAsString timeInMS={fastesRacerTime.time}></RaceTimeAsString>
              </ValueWithLabel>
              <ValueWithLabel label={t('commentator.race.racerSlowestLap')}>
                <RaceTimeAsString timeInMS={slowestRacerTime.time}></RaceTimeAsString>
              </ValueWithLabel>
            </ColumnLayout>
          </Container>

          <ColumnLayout columns={2}>
            <Table
              header={<Header variant="h2">{t('commentator.race.overallFastestLaps')}</Header>}
              columnDefinitions={columnDefinitions}
              visibleColumns={['time', 'racerName']}
              items={fastesLapsForTrack}
              loadingText={t('commentator.race.loading')}
              sortingDisabled
            ></Table>

            <Table
              header={<Header variant="h2">{t('commentator.race.overallSlowestLaps')}</Header>}
              columnDefinitions={columnDefinitions}
              visibleColumns={['time', 'racerName']}
              items={slowestLapsForTrack}
              loadingText={t('commentator.race.loading')}
              sortingDisabled
            ></Table>
          </ColumnLayout>
        </SpaceBetween>
      </PageLayout>
    </>
  );
};

export { CommenatorRaceStats };
