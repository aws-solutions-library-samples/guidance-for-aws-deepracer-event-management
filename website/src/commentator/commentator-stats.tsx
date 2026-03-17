import { SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../admin/events/support-functions/raceConfig';
import { EventSelectorModal } from '../components/eventSelectorModal';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { getLeaderboard, getRaces } from '../graphql/queries';
import { onAddedRace, onNewLeaderboardEntry, onNewOverlayInfo } from '../graphql/subscriptions';
import { useSelectedEventContext, useSelectedTrackContext } from '../store/contexts/storeProvider';
import { LeaderboardEntry, OverlayInfo, Race } from '../types/domain';
import { ActualRacerStatsNew } from './actual-racer-stats-new';
import { RaceLapInformation } from './race-lap-information';

// Extended LeaderboardEntry with fastestAverageLap
interface LeaderboardEntryWithAverage extends LeaderboardEntry {
  fastestAverageLap?: {
    avgTime: number;
  };
}

// GraphQL response types
interface GetLeaderboardResponse {
  getLeaderboard: {
    entries: LeaderboardEntryWithAverage[];
    trackId: string;
    eventId: string;
  };
}

interface GetRacesResponse {
  getRaces: Race[];
}

// Subscription event types
interface SubscriptionEvent<T> {
  provider: any;
  value: {
    data: T;
  };
}

// GraphQL Subscription type
type GraphQLSubscription = {
  unsubscribe: () => void;
};

const CommentatorStats: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-race-stats']);

  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  const [addedRaceSubscription, SetAddedRaceSubscription] = useState<GraphQLSubscription | undefined>();
  const [newOverlayInfoSubscription, setNewOverlayInfoSubscription] = useState<GraphQLSubscription | undefined>();
  const [newLeaderboardEntrySubscription, setNewLeaderboardEntrySubscription] = useState<GraphQLSubscription | undefined>();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithAverage[]>([]);
  const [overlayInfo, setOverlayInfo] = useState<OverlayInfo | null>(null);
  const [races, setRaces] = useState<Race[]>([]);

  /**
   * Get the leaderboard entry based on the provided username
   * @param username - Username to find
   * @param allEntries - All leaderboard entries
   * @returns Tuple of [entry index, leaderboard entry] or [undefined, undefined]
   */
  const findEntryByUsername = (
    username: string,
    allEntries: LeaderboardEntryWithAverage[]
  ): [number, LeaderboardEntryWithAverage] | [undefined, undefined] => {
    const index = allEntries.findIndex((entry) => entry.username === username);
    if (index !== -1) {
      const entry = allEntries[index];
      return [index, entry];
    }
    return [undefined, undefined];
  };

  const fastestSortFunction = (a: LeaderboardEntryWithAverage, b: LeaderboardEntryWithAverage): number =>
    a.fastestLapTime - b.fastestLapTime;

  const fastestAverageSortFunction = (a: LeaderboardEntryWithAverage, b: LeaderboardEntryWithAverage): number => {
    if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
    if (!a.fastestAverageLap) return 1;
    if (!b.fastestAverageLap) return -1;
    return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
  };

  /**
   * Update leaderboard with a new entry
   * @param newLeaderboardEntry - Leaderboard entry to be added or updated
   */
  const updateLeaderboardEntries = (newLeaderboardEntry: LeaderboardEntryWithAverage): void => {
    setLeaderboard((prevState) => {
      console.debug(newLeaderboardEntry);
      console.debug(prevState);
      const usernameToUpdate = newLeaderboardEntry.username;
      let newState = [...prevState];

      // Find user to update on leaderboard, if user exist
      const [oldEntryIndex, oldEntry] = findEntryByUsername(usernameToUpdate, prevState);
      console.debug(oldEntryIndex);
      console.debug(oldEntry);
      if (oldEntryIndex !== undefined && oldEntryIndex >= 0) {
        newState[oldEntryIndex] = newLeaderboardEntry;
      } else {
        newState = prevState.concat(newLeaderboardEntry);
      }

      // sort list according to fastestLapTime, ascending order
      const sortedLeaderboard = newState.sort(
        selectedEvent?.raceConfig?.rankingMethod === RaceTypeEnum.BEST_LAP_TIME
          ? fastestSortFunction
          : fastestAverageSortFunction
      );

      return sortedLeaderboard;
    });
  };

  const loadLeaderboard = async (): Promise<void> => {
    if (!selectedEvent?.eventId || !selectedTrack?.trackId) return;

    const eventId = selectedEvent.eventId;

    const response = await graphqlQuery<GetLeaderboardResponse>(
      getLeaderboard, { eventId: eventId, trackId: selectedTrack.trackId }
    );

    let sortedLeaderboard: LeaderboardEntryWithAverage[] = [];

    if (response?.getLeaderboard.entries && response.getLeaderboard.entries.length > 0) {
      sortedLeaderboard = response.getLeaderboard.entries.sort(
        selectedEvent?.raceConfig?.rankingMethod === RaceTypeEnum.BEST_LAP_TIME
          ? fastestSortFunction
          : fastestAverageSortFunction
      );
    }

    setLeaderboard(sortedLeaderboard);
  };

  const groupBy = <T,>(iterable: T[], groupByFn: (item: T) => string): Map<string, T[]> => {
    const resultMap = new Map<string, T[]>();

    iterable.forEach((item) => {
      const key = groupByFn(item);
      const collection = resultMap.get(key);
      if (collection) {
        collection.push(item);
      } else {
        resultMap.set(key, [item]);
      }
    });

    return resultMap;
  };

  const loadAllRaces = async (): Promise<void> => {
    if (!selectedEvent?.eventId) return;

    const eventId = selectedEvent.eventId;
    const response = await graphqlQuery<GetRacesResponse>(
      getRaces, { eventId: eventId }
    );

    const tmp = groupBy(response?.getRaces || [], ({ userId }) => userId);
    console.log('Mapped Races: ', tmp);
    setRaces(response?.getRaces || []);
  };

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent?.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  const unsubscribe = (): void => {
    if (addedRaceSubscription) {
      addedRaceSubscription.unsubscribe();
    }
    if (newOverlayInfoSubscription) {
      newOverlayInfoSubscription.unsubscribe();
    }
    if (newLeaderboardEntrySubscription) {
      newLeaderboardEntrySubscription.unsubscribe();
    }
  };

  useEffect(() => {
    if (!selectedEvent?.eventId || !selectedTrack?.trackId) return;

    loadLeaderboard();
    loadAllRaces();

    unsubscribe();

    const eventId = selectedEvent.eventId;
    const trackId = selectedTrack.trackId;

    SetAddedRaceSubscription(
      graphqlSubscribe<{ onAddedRace: Race }>(
        onAddedRace,
        { eventId, trackId }
      ).subscribe({
        next: (event) => {
          // update Races
          // setRaces((state) => state.concat(event.value.data.onAddedRace));
          // Leaderboard can be calculated from Races
          // loadLeaderboard();
        },
        error: (error: Error) => console.warn(error),
      })
    );

    setNewOverlayInfoSubscription(
      graphqlSubscribe<{ onNewOverlayInfo: OverlayInfo }>(
        onNewOverlayInfo,
        { eventId, trackId }
      ).subscribe({
        next: (event) => {
          const eventData = event.value.data.onNewOverlayInfo;
          //if (eventData.raceStatus === 'READY_TO_START') loadLeaderboard();

          setOverlayInfo(eventData);
        },
        error: (error: Error) => console.warn(error),
      })
    );

    setNewLeaderboardEntrySubscription(
      graphqlSubscribe<{ onNewLeaderboardEntry: LeaderboardEntryWithAverage }>(
        onNewLeaderboardEntry,
        { eventId, trackId }
      ).subscribe({
        next: ({ value }) => {
          console.debug('onNewLeaderboardEntry');
          const newEntry = value.data.onNewLeaderboardEntry;
          console.debug(newEntry);
          updateLeaderboardEntries(newEntry);
        },
        error: (error: Error) => console.warn(error),
      })
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, selectedTrack]);

  return (
    <>
      <PageLayout
        helpPanelHidden={false}
        helpPanelContent={
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-race-stats' })}
            bodyContent={t('content', { ns: 'help-race-stats' })}
            footerContent={t('footer', { ns: 'help-race-stats' })}
          />
        }
        header={t('commentator.race.header')}
        description={t('commentator.race.stats')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('commentator.breadcrumb'), href: '#' },
          { text: t('commentator.race.breadcrumb'), href: '/' },
        ]}
      >
        <EventSelectorModal
          visible={eventSelectModalVisible}
          onDismiss={() => setEventSelectModalVisible(false)}
          onOk={() => setEventSelectModalVisible(false)}
        />

        <SpaceBetween size="l">
          <ActualRacerStatsNew
            leaderboard={leaderboard as any}
            overlayInfo={overlayInfo as any}
            raceFormat={selectedEvent?.raceConfig?.rankingMethod || RaceTypeEnum.BEST_LAP_TIME}
          ></ActualRacerStatsNew>
          <RaceLapInformation
            overlayInformation={overlayInfo as any}
            selectedEvent={selectedEvent as any}
            sortedLeaderboard={leaderboard as any}
          ></RaceLapInformation>
        </SpaceBetween>
      </PageLayout>
    </>
  );
};

export { CommentatorStats };
