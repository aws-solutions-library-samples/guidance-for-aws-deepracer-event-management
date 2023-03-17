import { API, graphqlOperation } from 'aws-amplify';
import React, { useCallback, useEffect, useState } from 'react';
import Logo from '../assets/logo.png';
import { getLeaderboard } from '../graphql/queries';
import {
  onDeleteLeaderboardEntry,
  onNewLeaderboardEntry,
  onUpdateLeaderboardEntry,
} from '../graphql/subscriptions';
import { FollowFooter } from './followFooter';
import { Header } from './header';
import styles from './leaderboard.module.css';
import { LeaderboardTable } from './leaderboardTable';
import { RaceInfoFooter } from './raceInfoFooter';
import { RaceSummaryFooter } from './raceSummaryFooter';

const Leaderboard = ({ eventId, trackId }) => {
  const [leaderboardEntries, SetleaderboardEntries] = useState([]);
  const [headerText, SetHeaderText] = useState([]);
  const [qrCodeVisible, SetQrCodeVisible] = useState(false);
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
  });

  const [followFooterText, SetFollowFooterText] = useState('');

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
      console.log(entry);
      console.log(prevState);
      const [index] = findEntryByUsername(entry.username, prevState);
      console.info(index);
      if (index >= 0) {
        console.log([...prevState]);
        const updatedList = [...prevState];
        updatedList.splice(index, 1);
        console.info(updatedList);
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
    console.info(overallRank);

    // calculate consistency (previous leaderboard position)
    console.info(previousPostition);
    if (previousPostition) {
      newEntry.consistency = previousPostition;
    } else {
      newEntry.consistency = newEntry.overallRank;
    }
    console.info(newEntry.consistency);

    //calculate gap to fastest
    if (overallRank === 0) {
      newEntry.gapToFastest = 0;
    } else {
      newEntry.gapToFastest = newEntry.fastestLapTime - allEntries[0].fastestLapTime;
    }
    SetRaceSummaryData(newEntry);
  }, []);

  /**
   * Update leaderboard with a new entry
   * @param  {Object} newEntry Leaderboard entry to be added
   * @return {}
   */
  const updateLeaderboardEntries = (newLeaderboardEntry) => {
    SetleaderboardEntries((prevState) => {
      console.log(newLeaderboardEntry);
      const usernameToUpdate = newLeaderboardEntry.username;
      let newState = [...prevState];

      // Find user to update on leaderboard, if user exist
      const [oldEntryIndex, oldEntry] = findEntryByUsername(usernameToUpdate, prevState);
      console.info(oldEntryIndex);
      console.info(oldEntry);
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
        console.log(leaderboard);
        SetleaderboardEntries(leaderboard.entries);
        SetFollowFooterText(leaderboard.config.footerText);
        SetHeaderText(leaderboard.config.headerText);
        SetQrCodeVisible(leaderboard.config.qrCodeVisible);
      };
      getLeaderboardData();

      if (subscription) {
        subscription.unsubscribe();
      }
      SetSubscription(
        API.graphql(graphqlOperation(onNewLeaderboardEntry, { eventId: eventId })).subscribe({
          next: ({ provider, value }) => {
            console.log('onNewLeaderboardEntry');
            const newEntry = value.data.onNewLeaderboardEntry;
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
            console.log('onUpdateLeaderboardEntry');
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
            console.log('onDeleteLeaderboardEntry');
            const entryToDelete = value.data.onDeleteLeaderboardEntry;
            console.log(entryToDelete);
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
            <Header headerText={headerText} qrCodeVisible={qrCodeVisible} />
            <LeaderboardTable leaderboardEntries={leaderboardEntries} />
          </div>
          <FollowFooter visible text={followFooterText} />
          <RaceInfoFooter eventId={eventId} />
          <RaceSummaryFooter visible={racSummaryFooterIsVisible} {...raceSummaryData} />
        </div>
      )}
    </>
  );
};

export { Leaderboard };
