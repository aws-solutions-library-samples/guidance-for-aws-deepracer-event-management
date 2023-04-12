import { API, graphqlOperation } from 'aws-amplify';
import React, { useCallback, useEffect, useState } from 'react';
import Logo from '../assets/logo1024.png';
import { FollowFooter } from '../components/followFooter';
import { Header } from '../components/header';
import { LeaderboardTable } from '../components/leaderboardTable';
import { RaceInfoFooter } from '../components/raceInfoFooter';
import { RaceSummaryFooter } from '../components/raceSummaryFooter';
import { getLeaderboard } from '../graphql/queries';
import {
  onDeleteLeaderboardEntry,
  onNewLeaderboardEntry,
  onUpdateLeaderboardEntry,
} from '../graphql/subscriptions';
import styles from './leaderboard.module.css';

const Leaderboard = ({ eventId, trackId, showQrCode, scrollEnabled }) => {
  const [leaderboardEntries, SetleaderboardEntries] = useState([]);
  const [leaderboardConfig, setLeaderboardConfig] = useState({
    headerText: '',
    followFooterText: '',
  });
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
    console.debug(newEntry.consistency);

    //calculate gap to fastest
    if (overallRank === 0) {
      newEntry.gapToFastest = 0;
    } else {
      newEntry.gapToFastest = newEntry.fastestLapTime - allEntries[0].fastestLapTime;
    }
    console.log(newEntry)
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
      const sortedLeaderboard = newState.sort((a, b) => a.fastestLapTime - b.fastestLapTime);
      const oldPosition = oldEntryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
      calcRaceSummary(newLeaderboardEntry, oldPosition, sortedLeaderboard);
      return sortedLeaderboard;
    });
  };

  useEffect(() => {
    if (eventId) {
      const getLeaderboardData = async () => {
        const response = await API.graphql(
          graphqlOperation(getLeaderboard, { eventId: eventId, trackId: trackId })
        );
        const leaderboard = response.data.getLeaderboard;
        SetleaderboardEntries(leaderboard.entries);
        setLeaderboardConfig(leaderboard.config);
      };
      getLeaderboardData();

      if (subscription) {
        subscription.unsubscribe();
      }
      SetSubscription(
        API.graphql(graphqlOperation(onNewLeaderboardEntry, { eventId: eventId })).subscribe({
          next: ({ provider, value }) => {
            console.debug('onNewLeaderboardEntry');
            const newEntry = value.data.onNewLeaderboardEntry;
            console.log(newEntry)
            updateLeaderboardEntries(newEntry);
            SetraceSummaryFooterIsVisible(true);
            setTimeout(() => {
              SetraceSummaryFooterIsVisible(false);
            }, 10000);
          },
          error: (error) => console.warn(error),
        })
      );

      if (onUpdateSubscription) {
        onUpdateSubscription.unsubscribe();
      }
      SetOnUpdateSubscription(
        API.graphql(graphqlOperation(onUpdateLeaderboardEntry, { eventId: eventId })).subscribe({
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
        API.graphql(graphqlOperation(onDeleteLeaderboardEntry, { eventId: eventId })).subscribe({
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
            <Header headerText={leaderboardConfig.headerText} eventId={eventId} qrCodeVisible={showQrCode} />
            <LeaderboardTable
              leaderboardEntries={leaderboardEntries}
              scrollEnabled={scrollEnabled}
            />
          </div>
          <FollowFooter visible eventId={eventId} text={leaderboardConfig.followFooterText} qrCodeVisible={showQrCode} />
        </div>
      )}
      <RaceInfoFooter eventId={eventId} />
      <RaceSummaryFooter visible={racSummaryFooterIsVisible} {...raceSummaryData} />
    </>
  );
};

export { Leaderboard };
