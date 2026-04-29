import { generateClient } from 'aws-amplify/api';
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

const client = generateClient();

interface LeaderboardProps {
  eventId: string | undefined;
  trackId: string;
  raceFormat: string;
  language?: string;
  showQrCode: boolean;
  scrollEnabled: boolean;
  showFlag: boolean;
}

const Leaderboard = ({ eventId, trackId, raceFormat, showQrCode, scrollEnabled, showFlag }: LeaderboardProps) => {
  const [leaderboardEntries, SetleaderboardEntries] = useState<any[]>([]);
  const [leaderboardConfig, setLeaderboardConfig] = useState<any>({
    leaderBoardTitle: '',
    leaderBoardFooter: '',
  });
  const [subscription, SetSubscription] = useState<any>();
  const [onUpdateSubscription, SetOnUpdateSubscription] = useState<any>();
  const [onDeleteSubscription, SetOnDeleteSubscription] = useState<any>();

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
   * @param  {Array} allEntries all leaderboard entries
   * @return {[Number,Object]} entry index & leaderboard entry
   */
  const findEntryByUsername = (username: string, allEntries: any[]) => {
    const index = allEntries.findIndex((entry: any) => entry.username === username);
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
  const removeLeaderboardEntry = (entry: any) => {
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
   * @param {Array} allEntries    All leaderboard entries
   * @return {}
   */
  const calcRaceSummary = useCallback((newEntry: any, previousPostition: number, allEntries: any[]) => {
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
      if (raceFormat === 'fastest') {
        newEntry.gapToFastest = newEntry.fastestLapTime - allEntries[0].fastestLapTime;
      } else if (newEntry.fastestAverageLap) {
        newEntry.gapToFastest = newEntry.fastestAverageLap.avgTime - allEntries[0].fastestAverageLap.avgTime;
      } else {
        newEntry.gapToFastest = null;
      }
    }
    SetRaceSummaryData(newEntry);
  }, []);

  /**
   * Update leaderboard with a new entry
   * @param  {Object} newLeaderboardEntry Leaderboard entry to be added
   * @return {}
   */
  const updateLeaderboardEntries = (newLeaderboardEntry: any) => {
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
          // for combined leaderboard, only update the entry when new entry has faster lap time
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
      const fastestSortFunction = (a: any, b: any) => a.fastestLapTime - b.fastestLapTime;
      const fastestAverageSortFunction = (a: any, b: any) => {
        if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
        if (!a.fastestAverageLap) return 1;
        if (!b.fastestAverageLap) return -1;
        return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
      };

      const sortedLeaderboard = newState.sort(
        raceFormat === 'fastest' ? fastestSortFunction : fastestAverageSortFunction
      );

      const oldPosition = oldEntryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
      calcRaceSummary(newLeaderboardEntry, oldPosition, sortedLeaderboard);
      return sortedLeaderboard;
    });
  };

  useEffect(() => {
    if (eventId) {
      const getLeaderboardData = async () => {
        const response = await client.graphql({
          query: getLeaderboard,
          variables: { eventId: eventId, trackId: trackId },
        }) as any;
        const leaderboard = response.data.getLeaderboard;
        response.data.getLeaderboard.entries.forEach((entry: any) => updateLeaderboardEntries(entry));
        setLeaderboardConfig(leaderboard.config);
      };
      getLeaderboardData();

      if (subscription) {
        subscription.unsubscribe();
      }
      // get all updates if trackId == 'combined'
      const subscriptionTrackId = trackId === 'combined' ? undefined : trackId;
      SetSubscription(
        (client
          .graphql({
            query: onNewLeaderboardEntry,
            variables: { eventId: eventId, trackId: subscriptionTrackId },
          }) as any)
          .subscribe({
            next: ({ data }: any) => {
              console.debug('onNewLeaderboardEntry');
              const newEntry = data.onNewLeaderboardEntry;
              console.debug(newEntry);
              updateLeaderboardEntries(newEntry);
              SetraceSummaryFooterIsVisible(true);
              setTimeout(() => {
                SetraceSummaryFooterIsVisible(false);
              }, 12000);
            },
            error: (error: any) => console.warn(error),
          })
      );

      if (onUpdateSubscription) {
        onUpdateSubscription.unsubscribe();
      }
      SetOnUpdateSubscription(
        (client
          .graphql({
            query: onUpdateLeaderboardEntry,
            variables: { eventId: eventId, trackId: subscriptionTrackId },
          }) as any)
          .subscribe({
            next: ({ data }: any) => {
              console.debug('onUpdateLeaderboardEntry');
              const newEntry = data.onUpdateLeaderboardEntry;
              updateLeaderboardEntries(newEntry);
            },
            error: (error: any) => console.warn(error),
          })
      );

      if (onDeleteSubscription) {
        onDeleteSubscription.unsubscribe();
      }
      SetOnDeleteSubscription(
        (client
          .graphql({
            query: onDeleteLeaderboardEntry,
            variables: { eventId: eventId, trackId: subscriptionTrackId },
          }) as any)
          .subscribe({
            next: ({ data }: any) => {
              console.debug('onDeleteLeaderboardEntry');
              const entryToDelete = data.onDeleteLeaderboardEntry;
              console.debug(entryToDelete);
              removeLeaderboardEntry(entryToDelete);
            },
            error: (error: any) => console.warn(error),
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
              raceFormat={raceFormat}
              qrCodeVisible={showQrCode}
            />
            <LeaderboardTable
              leaderboardEntries={leaderboardEntries}
              scrollEnabled={scrollEnabled}
              fastest={raceFormat === 'fastest'}
              showFlag={showFlag}
            />
          </div>
          <FollowFooter
            visible
            eventId={eventId}
            trackId={trackId}
            raceFormat={raceFormat}
            text={leaderboardConfig.leaderBoardFooter}
            qrCodeVisible={showQrCode}
          />
        </div>
      )}
      <RaceInfoFooter
        visible={!racSummaryFooterIsVisible}
        eventId={eventId ?? ''}
        trackId={trackId}
        raceFormat={raceFormat}
      />
      <RaceSummaryFooter visible={racSummaryFooterIsVisible} {...raceSummaryData} raceFormat={raceFormat} />
    </>
  );
};

export { Leaderboard };
