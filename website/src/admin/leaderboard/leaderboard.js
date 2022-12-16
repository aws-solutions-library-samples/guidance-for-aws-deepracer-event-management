import { API, graphqlOperation } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';

import Logo from '../../assets/logo-bw.png';
import { getLeaderBoardEntries } from '../../graphql/queries';
import { onNewFastestLapForUser } from '../../graphql/subscriptions';
import useQuery from '../../hooks/useQuery';
import { eventContext } from '../../store/EventProvider';
import SideNavContext from '../../store/SideNavContext';
import styles from './leaderboard.module.css';

const Leaderboard = () => {
  const [leaderboardEntries, SetleaderboardEntries] = useState([]);
  const [leaderboardListItems, SetLeaderboardListItems] = useState(<div></div>);
  // const [isSubscribed, SetIsSubscribed] = useState(false);
  const [subscription, SetSubscription] = useState();
  const { setNavigationOpen } = useContext(SideNavContext);
  const { selectedEvent } = useContext(eventContext);
  const [allLeaderboardEntriesFromBackend] = useQuery('getLeaderBoardEntries', {
    eventId: selectedEvent.eventId,
  });

  // ensure sidenav is closed when leaderboard is opened
  useEffect(() => {
    setNavigationOpen(false);
  }, [setNavigationOpen]);

  useEffect(() => {
    if (allLeaderboardEntriesFromBackend) {
      console.log('LEADERBOARD DATA');
      console.log(allLeaderboardEntriesFromBackend);
      SetleaderboardEntries(allLeaderboardEntriesFromBackend);
    } else {
      SetleaderboardEntries([]);
    }
  }, [allLeaderboardEntriesFromBackend]);

  useEffect(() => {
    if (selectedEvent) {
      console.info('NEW EVENT SELECTED - UPDATE LEADERBOARD');
      // // TODO move into useQuery custom hook
      const getLeaderboardEntries = async () => {
        const response = await API.graphql(
          graphqlOperation(getLeaderBoardEntries, { eventId: selectedEvent.eventId })
        );
        SetleaderboardEntries(response.data.getLeaderBoardEntries);
      };
      getLeaderboardEntries();

      if (subscription) {
        subscription.unsubscribe();
      }
      SetSubscription(
        API.graphql(
          // graphqlOperation(onNewFastestLapForUser, { eventId: selectedEvent.eventId })
          graphqlOperation(onNewFastestLapForUser)
        ).subscribe({
          next: ({ provider, value }) => {
            updateLeaderboardEntries(value.data.onNewFastestLapForUser);
          },
          error: (error) => console.warn(error),
        })
      );
      console.log('Subscribed to onNewFastestLapForUser for event  ' + selectedEvent.eventName);

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [selectedEvent]);

  const convertMsToString = (timeInMS) => {
    const millisecondsAsString = String(Math.floor(timeInMS % 1000)).padStart(3, '0');
    const secondsAsString = String(Math.floor(timeInMS / 1000)).padStart(2, '0');
    const seconds = Math.floor(timeInMS / 1000);
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    const timeAsString = `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
    return timeAsString;
  };

  const updateLeaderboardEntries = (newLeaderboardEntry) => {
    SetleaderboardEntries((prevState) => {
      const usernameToUpdate = newLeaderboardEntry.username;
      let userFound = false;
      let newState = [...prevState];

      for (let index = 0; index < prevState.length; index++) {
        const leaderboardEntry = prevState[index];
        const username = leaderboardEntry.username;
        if (username === usernameToUpdate) {
          userFound = true;
          newState[index] = newLeaderboardEntry;
          break;
        }
      }
      if (userFound === false) {
        newState = prevState.concat(newLeaderboardEntry);
      }

      return newState.sort((a, b) => parseFloat(a.time) - parseFloat(b.time));
    });
  };

  // Update the leaderboard list
  useEffect(() => {
    console.log('Update leaderboard list items');
    const items = leaderboardEntries.map((entry, index) => (
      <li key={entry.username} className={`${styles.listEntry} ${styles.moduleRow}`}>
        <div className={styles.liPosition}>#{index + 1}</div>
        <div className={styles.liRacer}>{entry.username}</div>
        <div className={styles.liTime}>{convertMsToString(entry.time)}</div>
      </li>
    ));
    SetLeaderboardListItems(items);
  }, [leaderboardEntries]);

  return (
    <React.Fragment>
      {leaderboardEntries.length === 0 && (
        <div className={styles.logoContainer}>
          <img src={Logo} alt="DeepRacer Logo" width="50%" height="50%"></img>
        </div>
      )}
      {leaderboardEntries.length > 0 && (
        <div>
          <div className={styles.moduleHeaders}>
            <div className={styles.modulePosition}>POSITION</div>
            <div className={styles.moduleRacer}>RACER</div>
            <div className={styles.moduleResults}>TIME</div>
          </div>
          <ul>{leaderboardListItems}</ul>
        </div>
      )}
    </React.Fragment>
  );
};

export { Leaderboard };
