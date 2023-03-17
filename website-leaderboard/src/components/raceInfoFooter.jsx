import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { onNewOverlayInfo } from '../graphql/subscriptions';
import styles from './raceInfoFooter.module.css';

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
    timeLeft: { minutes: '00', seconds: '00' },
  });
  const [isVisible, SetIsVisible] = useState(false);

  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onNewOverlayInfo, { eventId: eventId })
    ).subscribe({
      next: ({ provider, value }) => {
        const raceInfo = value.data.onNewOverlayInfo;
        console.info(raceInfo);
        if (racesStatusesWithFooterVisible.includes(raceInfo.raceStatus)) {
          SetRaceInfo((prevstate) => {
            return {
              username: raceInfo.username,
              timeLeft: convertMsToTime(raceInfo.timeLeftInMs),
            };
          });
          SetIsVisible(true);
        } else {
          SetRaceInfo();
          SetIsVisible(false);
        }
      },
      error: (error) => console.warn(error),
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [eventId]);

  const convertMsToTime = (timeInMs) => {
    let seconds = Math.floor((timeInMs / 1000) % 60);
    let minutes = Math.floor(timeInMs / (1000 * 60));

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return {
      seconds,
      minutes,
    };
  };

  return (
    <>
      {isVisible && (
        <div className={styles.footerRoot}>
          <div>
            <span className={styles.footerHeader}>Currently racing: </span>
            <span className={styles.footerText}>{raceInfo.username}</span>
          </div>
          <div>
            <span className={styles.footerHeader}>Time left: </span>
            <span className={styles.footerText}>
              {raceInfo.timeLeft.minutes}:{raceInfo.timeLeft.seconds}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export { RaceInfoFooter };
