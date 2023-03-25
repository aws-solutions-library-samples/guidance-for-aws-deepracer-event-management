import ColumnLayout from '@cloudscape-design/components/column-layout';
import { API, graphqlOperation } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Header from '@cloudscape-design/components/header';
import { getLeaderboard } from '../graphql/queries';
import { eventContext } from '../store/eventProvider';

import { Table } from '@cloudscape-design/components';
import { RaceTimeAsString } from '../components/raceTimeAsString';

import { onNewLeaderboardEntry } from '../graphql/subscriptions';

const LeaderboardStats = ({itemsToShow = 5}) => {

    const { t } = useTranslation();

    const { selectedEvent } = useContext(eventContext);
    const [subscription, SetSubscription] = useState();

    const [fastesLapsForTrack, SetFastestLapsForTrack] = useState([]);
    const [slowestLapsForTrack, SetSlowestLapsForTrack] = useState([]);

    const loadLeaderboard = async () => {
        const eventId = selectedEvent.eventId;

        const response = await API.graphql(
          graphqlOperation(getLeaderboard, { eventId: eventId, trackId: 1 })
        );
        const leaderboard = response.data.getLeaderboard;
        const mustBeSliced = leaderboard.entries.length > itemsToShow
        console.info(response.data.getLeaderboard);
        console.info(mustBeSliced)

        SetFastestLapsForTrack(
          mustBeSliced ? leaderboard.entries.slice(0, itemsToShow) : leaderboard.entries
        );
        SetSlowestLapsForTrack(
            mustBeSliced ? leaderboard.entries.slice(-itemsToShow).reverse(): leaderboard.entries.slice().reverse()
        );
      };

    useEffect(() => {
        if (selectedEvent) {
          loadLeaderboard();

          if (subscription) {
            subscription.unsubscribe();
          }

          const eventId = selectedEvent.eventId;
          console.info(eventId);

          SetSubscription(
            API.graphql(graphqlOperation(onNewLeaderboardEntry, { eventId: eventId })).subscribe({
                next: () => loadLeaderboard(),
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
    );
}

export { LeaderboardStats };
