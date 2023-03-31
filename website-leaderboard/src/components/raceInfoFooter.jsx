import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { onNewOverlayInfo } from '../graphql/subscriptions';
import { useWindowSize } from '../hooks/useWindowSize';
import styles from './raceInfoFooter.module.css';
import RaceTimer from './raceTimer';

// import { useTranslation } from 'react-i18next'; // TODO translations missing

const racesStatusesWithFooterVisible = [
  //'NO_RACER_SELECTED',
  'READY_TO_START',
  'RACE_IN_PROGRESS',
  'RACE_PAUSED',
  //'RACE_FINSIHED',
];

const RaceInfoFooter = ({ eventId }) => {
  const [raceInfo, SetRaceInfo] = useState({
    username: '',
    timeLeftInMs: null,
  });
  const [isVisible, SetIsVisible] = useState(false);
  const [timerIsRunning, SetTimerIsRunning] = useState(false);

  const windowSize = useWindowSize();
  const aspectRatio = windowSize.width / windowSize.height;

  const ManageTimer = (raceStatus) => {
    if (raceStatus === 'RACE_IN_PROGRESS') {
      SetTimerIsRunning(true);
    } else {
      SetTimerIsRunning(false);
    }
  };

  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onNewOverlayInfo, { eventId: eventId })
    ).subscribe({
      next: ({ provider, value }) => {
        const raceInfo = value.data.onNewOverlayInfo;
        if (racesStatusesWithFooterVisible.includes(raceInfo.raceStatus)) {
          SetRaceInfo((prevstate) => {
            return {
              username: raceInfo.username,
              timeLeftInMs: raceInfo.timeLeftInMs,
            };
          });
          SetIsVisible(true);
        } else {
          SetRaceInfo();
          SetIsVisible(false);
        }
        ManageTimer(raceInfo.raceStatus);
      },
      error: (error) => console.warn(error),
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [eventId]);

  let username;
  if (raceInfo) {
    username = raceInfo.username;
    if (aspectRatio < 1.2 && username.length > 15) {
      username = username.substr(0, 20) + '...';
    } else if (username.length > 30) {
      username = username.substr(0, 30) + '...';
    }
  }
  return (
    <>
      {isVisible && (
        <div className={styles.footerRoot}>
          <div>
            <span className={styles.footerName}>Currently racing: </span>
            <span className={styles.footerName}>{username}</span>
          </div>
          <div>
            <span className={styles.footerCountdown}>
              <RaceTimer timerIsRunning={timerIsRunning} timeLeftInMs={raceInfo.timeLeftInMs} />
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export { RaceInfoFooter };
