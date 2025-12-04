import { SpaceBetween } from '@cloudscape-design/components';
import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../admin/events/support-functions/raceConfig';
import { EventSelectorModal } from '../components/eventSelectorModal';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { getLeaderboard, getRaces } from '../graphql/queries';
import { onAddedRace, onNewLeaderboardEntry, onNewOverlayInfo } from '../graphql/subscriptions';
import { useSelectedEventContext, useSelectedTrackContext } from '../store/contexts/storeProvider';
import { ActualRacerStatsNew } from './actual-racer-stats-new';
import { RaceLapInformation } from './race-lap-information';

const CommentatorStats = () => {
  const { t } = useTranslation(['translation', 'help-race-stats']);

  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  const [addedRaceSubscription, SetAddedRaceSubscription] = useState();
  const [newOverlayInfoSubscription, setNewOverlayInfoSubscription] = useState();
  const [newLeaderboardEntrySubscription, setNewLeaderboardEntrySubscription] = useState();

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);
  const [leaderboard, setLeaderboard] = useState({});
  const [overlayInfo, setOverlayInfo] = useState({});
  const [races, setRaces] = useState([]);

  /**
   * Get the leaderboard entry based on the provided username
   * @param  {string} username entry to remove
   * @param  {Array[Object]} allEntries all leaderbaord entries
   * @return {[Number,Object]} entry index & leaderboard entry
   */
  const findEntryByUsername = (username, allEntries) => {
    const index = allEntries.findIndex((entry) => entry.username === username);
    if (index !== -1) {
      const entry = allEntries[index];
      return [index, entry];
    }
    return [undefined, undefined];
  };

  const fastestSortFunction = (a, b) => a.fastestLapTime - b.fastestLapTime;
  const fastestAverageSortFunction = (a, b) => {
    if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
    if (!a.fastestAverageLap) return 1;
    if (!b.fastestAverageLap) return -1;
    return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
  };
  const totalTimeSortFunction = (a, b) => {
    // Exclude entries with 0 valid laps
    if (a.numberOfValidLaps === 0 && b.numberOfValidLaps === 0) return 0;
    if (a.numberOfValidLaps === 0) return 1;
    if (b.numberOfValidLaps === 0) return -1;
    // Sort by total lap time ascending (lowest first)
    return (a.totalLapTime || 0) - (b.totalLapTime || 0);
  };
  /**
   * Update leaderboard with a new entry
   * @param  {Object} newEntry Leaderboard entry to be added
   * @return {}
   */
  const updateLeaderboardEntries = (newLeaderboardEntry) => {
    setLeaderboard((prevState) => {
      console.debug(newLeaderboardEntry);
      console.debug(prevState);
      const usernameToUpdate = newLeaderboardEntry.username;
      let newState = [...prevState];

      // Find user to update on leaderboard, if user exist
      const [oldEntryIndex, oldEntry] = findEntryByUsername(usernameToUpdate, prevState);
      console.debug(oldEntryIndex);
      console.debug(oldEntry);
      if (oldEntryIndex >= 0) {
        newState[oldEntryIndex] = newLeaderboardEntry;
      } else {
        newState = prevState.concat(newLeaderboardEntry);
      }

      // sort list according to fastestLapTime, ascending order
      const sortedLeaderboard = newState.sort(
        selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.BEST_LAP_TIME
          ? fastestSortFunction
          : selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.TOTAL_RACE_TIME
          ? totalTimeSortFunction
          : fastestAverageSortFunction
      );

      // Filter out entries with 0 valid laps for TOTAL_RACE_TIME
      if (selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.TOTAL_RACE_TIME) {
        return sortedLeaderboard.filter(entry => entry.numberOfValidLaps > 0);
      }

      return sortedLeaderboard;
    });
  };

  const loadLeaderboard = async () => {
    const eventId = selectedEvent.eventId;

    const response = await API.graphql(
      graphqlOperation(getLeaderboard, { eventId: eventId, trackId: selectedTrack.trackId })
    );

    var sortedLeaderboard = [];

    if (response.data.getLeaderboard.entries && response.data.getLeaderboard.entries.length > 0) {
      sortedLeaderboard = response.data.getLeaderboard.entries.sort(
        selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.BEST_LAP_TIME
          ? fastestSortFunction
          : selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.TOTAL_RACE_TIME
          ? totalTimeSortFunction
          : fastestAverageSortFunction
      );

      // Filter out entries with 0 valid laps for TOTAL_RACE_TIME
      if (selectedEvent.raceConfig.rankingMethod === RaceTypeEnum.TOTAL_RACE_TIME) {
        sortedLeaderboard = sortedLeaderboard.filter(entry => entry.numberOfValidLaps > 0);
      }
    }

    setLeaderboard(sortedLeaderboard);
  };

  const groupBy = (iterable, groupByFn) => {
    const resultMap = new Map();

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

  const loadAllRaces = async () => {
    const eventId = selectedEvent.eventId;
    const response = await API.graphql(graphqlOperation(getRaces, { eventId: eventId }));
    const tmp = groupBy(response.data.getRaces, ({ userId }) => userId);
    console.log('Mapped Races: ', tmp);
    setRaces(response.data.getRaces);
  };

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  const unsubscribe = () => {
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
    if (selectedEvent || selectedTrack) {
      loadLeaderboard();
      loadAllRaces();

      unsubscribe();

      const eventId = selectedEvent.eventId;
      SetAddedRaceSubscription(
        API.graphql(
          graphqlOperation(onAddedRace, {
            eventId: eventId,
            trackId: selectedTrack.trackId,
          })
        ).subscribe({
          next: (event) => {
            // update Races
            // setRaces((state) => state.concat(event.value.data.onAddedRace));
            // Leaderboard can be calculated from Races
            // loadLeaderboard();
          },
          error: (error) => console.warn(error),
        })
      );

      setNewOverlayInfoSubscription(
        API.graphql(
          graphqlOperation(onNewOverlayInfo, {
            eventId: eventId,
            trackId: selectedTrack.trackId,
          })
        ).subscribe({
          next: (event) => {
            const eventData = event.value.data.onNewOverlayInfo;
            //if (eventData.raceStatus === 'READY_TO_START') loadLeaderboard();

            setOverlayInfo(eventData);
          },
          error: (error) => console.warn(error),
        })
      );

      setNewLeaderboardEntrySubscription(
        API.graphql(
          graphqlOperation(onNewLeaderboardEntry, {
            eventId: eventId,
            trackId: selectedTrack.trackId,
          })
        ).subscribe({
          next: ({ provider, value }) => {
            console.debug('onNewLeaderboardEntry');
            const newEntry = value.data.onNewLeaderboardEntry;
            console.debug(newEntry);
            updateLeaderboardEntries(newEntry);
          },
          error: (error) => console.warn(error),
        })
      );

      return unsubscribe;
    }
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
          { text: t('commentator.breadcrumb') },
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
            leaderboard={leaderboard}
            overlayInfo={overlayInfo}
            raceFormat={selectedEvent.raceConfig.rankingMethod}
          ></ActualRacerStatsNew>
          <RaceLapInformation
            overlayInformation={overlayInfo}
            selectedEvent={selectedEvent}
            sortedLeaderboard={leaderboard}
          ></RaceLapInformation>
        </SpaceBetween>
      </PageLayout>
    </>
  );
};

export { CommentatorStats };
