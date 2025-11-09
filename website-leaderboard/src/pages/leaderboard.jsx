import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import Logo from '../assets/logo1024.png';
import { FollowFooter } from '../components/followFooter';
import { Header } from '../components/header';
import { LeaderboardTable } from '../components/leaderboardTable';
import { RaceInfoFooter } from '../components/raceInfoFooter';
import { RaceSummaryFooter } from '../components/raceSummaryFooter';
import { getLeaderboard } from '../graphql/queries';
import { onDeleteLeaderboardEntry, onNewLeaderboardEntry, onUpdateLeaderboardEntry } from '../graphql/subscriptions';
import styles from './leaderboard.module.css';

const Leaderboard = ({ eventId, trackId, raceFormat, showQrCode, scrollEnabled, showFlag }) => {
  const [leaderboardEntries, SetleaderboardEntries] = useState([]);
  const [leaderboardConfig, setLeaderboardConfig] = useState({
    headerText: '',
    followFooterText: '',
  });
  const [actualRaceFormat, setActualRaceFormat] = useState(raceFormat);
  const [subscription, SetSubscription] = useState();
  const [onUpdateSubscription, SetOnUpdateSubscription] = useState();
  const [onDeleteSubscription, SetOnDeleteSubscription] = useState();

  const [racSummaryFooterIsVisible, SetraceSummaryFooterIsVisible] = useState(false);
  const [raceSummaryData, SetRaceSummaryData] = useState({
    racerName: undefined,
    overallRank: undefined,
    consistency: undefined,
    gapToFastest: undefined,
    fastestTime: undefined,
    fastestAverageLap: undefined,
    mostConcecutiveLaps: undefined,
    avgLapTime: undefined,
    lapCompletionRation: undefined,
    avgLapsPerAttempt: undefined,
    countryCode: undefined,
  });

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

  /**
   * Removes the entry from the leaderboard
   * @param  {Object} entry entry to remove
   * @return {}
   */
  const removeLeaderboardEntry = (entry) => {
    SetleaderboardEntries((prevState) => {
      console.debug(entry);
      console.debug(prevState);
      const [index] = findEntryByUsername(entry.username, prevState);
      console.debug(index);
      if (index >= 0) {
        console.debug([...prevState]);
        const updatedList = [...prevState];
        updatedList.splice(index, 1);
        console.debug(updatedList);
        return updatedList;
      }
      return prevState;
    });
  };

  /**
   * Calculate overall rank (current leaderboard position)
   * @param  {Object} newEntry
   * @param  {Number} previousPostition
   * @param {Array[Object]} allEntries    All lederboard entries
   * @return {}
   */
  const calcRaceSummary = useCallback((newEntry, previousPostition, allEntries) => {
    const [entryIndex] = findEntryByUsername(newEntry.username, allEntries);
    const overallRank = entryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
    newEntry.overallRank = overallRank;
    console.debug(overallRank);

    // calculate consistency (previous leaderboard position)
    console.debug(previousPostition);
    if (previousPostition) {
      newEntry.consistency = previousPostition;
    } else {
      newEntry.consistency = newEntry.overallRank;
    }
    console.debug(newEntry);

    //calculate gap to fastest
    if (overallRank === 0) {
      newEntry.gapToFastest = 0;
    } else {
      if (actualRaceFormat === 'fastest') {
        newEntry.gapToFastest = newEntry.fastestLapTime - allEntries[0].fastestLapTime;
      } else if (actualRaceFormat === 'total') {
        newEntry.gapToFastest = newEntry.totalLapTime - allEntries[0].totalLapTime;
      } else if (newEntry.fastestAverageLap) {
        newEntry.gapToFastest = newEntry.fastestAverageLap.avgTime - allEntries[0].fastestAverageLap.avgTime;
      } else {
        newEntry.gapToFastest = null;
      }
    }
    //console.debug(newEntry);
    SetRaceSummaryData(newEntry);
  }, []);

  /**
   * Update leaderboard with a new entry
   * @param  {Object} newEntry Leaderboard entry to be added
   * @return {}
   */
  const updateLeaderboardEntries = (newLeaderboardEntry) => {
    SetleaderboardEntries((prevState) => {
      console.debug(newLeaderboardEntry);
      console.debug(prevState);
      const usernameToUpdate = newLeaderboardEntry.username;
      let newState = [...prevState];

      // Find user to update on leaderboard, if user exist
      const [oldEntryIndex, oldEntry] = findEntryByUsername(usernameToUpdate, prevState);
      console.debug(oldEntryIndex);
      console.debug(oldEntry);
      if (oldEntryIndex >= 0) {
        if (trackId === 'combined') {
          // for combined leaderboard, only update  the entry when new entry has faster lap time
          // this might be done in the backend in the future
          newState[oldEntryIndex] = newLeaderboardEntry;

          if (
            oldEntry.trackId !== newLeaderboardEntry.trackId &&
            oldEntry.fastestLapTime < newLeaderboardEntry.fastestLapTime
          ) {
            newState[oldEntryIndex] = oldEntry;
          } else {
            newState[oldEntryIndex] = newLeaderboardEntry;
          }
        } else {
          newState[oldEntryIndex] = newLeaderboardEntry;
        }
      } else {
        newState = prevState.concat(newLeaderboardEntry);
      }

      // sort list according to fastestLapTime, ascending order
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
        return (a.totalLapTime || 0) - (b.totalLapTime || 0);
      };

      let sortedLeaderboard = newState.sort(
        actualRaceFormat === 'fastest' ? fastestSortFunction : 
        actualRaceFormat === 'total' ? totalTimeSortFunction :
        fastestAverageSortFunction
      );

      // Filter out entries with 0 valid laps for total race time
      if (actualRaceFormat === 'total') {
        sortedLeaderboard = sortedLeaderboard.filter(entry => entry.numberOfValidLaps > 0);
      }

      const oldPosition = oldEntryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
      calcRaceSummary(newLeaderboardEntry, oldPosition, sortedLeaderboard);
      return sortedLeaderboard;
    });
  };

  useEffect(() => {
    if (eventId) {
      const getLeaderboardData = async () => {
        const response = await API.graphql(graphqlOperation(getLeaderboard, { eventId: eventId, trackId: trackId }));
        const leaderboard = response.data.getLeaderboard;
        
        // Auto-detect race format from data if not explicitly set in URL
        if (!raceFormat && leaderboard.entries && leaderboard.entries.length > 0) {
          const firstEntry = leaderboard.entries[0];
          // Check which field has meaningful data to determine format
          if (firstEntry.totalLapTime && firstEntry.totalLapTime > 0) {
            setActualRaceFormat('total');
          } else if (firstEntry.fastestAverageLap) {
            setActualRaceFormat('average');
          } else {
            setActualRaceFormat('fastest');
          }
        } else if (raceFormat) {
          setActualRaceFormat(raceFormat);
        } else {
          // Default fallback
          setActualRaceFormat('fastest');
        }
        
        response.data.getLeaderboard.entries.forEach((entry) => updateLeaderboardEntries(entry));
        setLeaderboardConfig(leaderboard.config);
      };
      getLeaderboardData();

      if (subscription) {
        subscription.unsubscribe();
      }
      // get all updates if trackId == 'combined'
      const subscriptionTrackId = trackId === 'combined' ? undefined : trackId;
      SetSubscription(
        API.graphql(
          graphqlOperation(onNewLeaderboardEntry, {
            eventId: eventId,
            trackId: subscriptionTrackId,
          })
        ).subscribe({
          next: ({ provider, value }) => {
            console.debug('onNewLeaderboardEntry');
            const newEntry = value.data.onNewLeaderboardEntry;
            console.debug(newEntry);
            updateLeaderboardEntries(newEntry);
            SetraceSummaryFooterIsVisible(true);
            setTimeout(() => {
              SetraceSummaryFooterIsVisible(false);
            }, 12000);
          },
          error: (error) => console.warn(error),
        })
      );

      if (onUpdateSubscription) {
        onUpdateSubscription.unsubscribe();
      }
      SetOnUpdateSubscription(
        API.graphql(
          graphqlOperation(onUpdateLeaderboardEntry, {
            eventId: eventId,
            trackId: subscriptionTrackId,
          })
        ).subscribe({
          next: ({ provider, value }) => {
            console.debug('onUpdateLeaderboardEntry');
            const newEntry = value.data.onUpdateLeaderboardEntry;
            updateLeaderboardEntries(newEntry);
          },
          error: (error) => console.warn(error),
        })
      );

      if (onDeleteSubscription) {
        onDeleteSubscription.unsubscribe();
      }
      SetOnDeleteSubscription(
        API.graphql(
          graphqlOperation(onDeleteLeaderboardEntry, {
            eventId: eventId,
            trackId: subscriptionTrackId,
          })
        ).subscribe({
          next: ({ provider, value }) => {
            console.debug('onDeleteLeaderboardEntry');
            const entryToDelete = value.data.onDeleteLeaderboardEntry;
            console.debug(entryToDelete);
            removeLeaderboardEntry(entryToDelete);
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
  }, [eventId, trackId]);

  return (
    <>
      {leaderboardEntries.length === 0 && (
        <div className={styles.logoContainer}>
          <img src={Logo} alt="DeepRacer Logo" className={styles.loadImage}></img>
        </div>
      )}
      {leaderboardEntries.length > 0 && (
        <div className={styles.pageRoot}>
          <div className={styles.leaderboardRoot}>
            <Header
              headerText={leaderboardConfig.leaderBoardTitle}
              eventId={eventId}
              trackId={trackId}
              raceFormat={actualRaceFormat}
              qrCodeVisible={showQrCode}
            />
            <LeaderboardTable
              leaderboardEntries={leaderboardEntries}
              scrollEnabled={scrollEnabled}
              fastest={actualRaceFormat === 'fastest'}
              showFlag={showFlag}
              raceFormat={actualRaceFormat}
            />
          </div>
          <FollowFooter
            visible
            eventId={eventId}
            trackId={trackId}
            raceFormat={actualRaceFormat}
            text={leaderboardConfig.leaderBoardFooter}
            qrCodeVisible={showQrCode}
          />
        </div>
      )}
      <RaceInfoFooter
        visible={!racSummaryFooterIsVisible}
        eventId={eventId}
        trackId={trackId}
        raceFormat={actualRaceFormat}
      />
      <RaceSummaryFooter visible={racSummaryFooterIsVisible} {...raceSummaryData} raceFormat={actualRaceFormat} />
    </>
  );
};

export { Leaderboard };
