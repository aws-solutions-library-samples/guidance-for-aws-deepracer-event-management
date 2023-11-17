import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { onNewOverlayInfo } from '../graphql/subscriptions';
import { useWindowSize } from '../hooks/useWindowSize';
import styles from './raceInfoFooter.module.css';
import RaceOverlayInfo from './raceOverlayInfo';

// import { useTranslation } from 'react-i18next';

const racesStatusesWithFooterVisible = [
  //'NO_RACER_SELECTED',
  'READY_TO_START',
  'RACE_IN_PROGRESS',
  'RACE_PAUSED',
  //'RACE_FINSIHED',
];

const RaceInfoFooter = ({ eventId, trackId, visible, raceFormat }) => {
  const [raceInfo, SetRaceInfo] = useState({
    username: '',
    timeLeftInMs: null,
    raceStatus: '',
    laps: [],
    currentLapTimeInMs: null,
  });
  const [isVisible, SetIsVisible] = useState(false);

  const windowSize = useWindowSize();
  const aspectRatio = windowSize.width / windowSize.height;

  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onNewOverlayInfo, { eventId: eventId, trackId: trackId })
    ).subscribe({
      next: ({ provider, value }) => {
        const raceInfo = value.data.onNewOverlayInfo;
        if (racesStatusesWithFooterVisible.includes(raceInfo.raceStatus)) {
          SetRaceInfo((prevstate) => {
            return {
              username: raceInfo.username,
              timeLeftInMs: raceInfo.timeLeftInMs,
              raceStatus: raceInfo.raceStatus,
              laps: raceInfo.laps,
              currentLapTimeInMs: raceInfo.currentLapTimeInMs,
              averageLaps: raceInfo.averageLaps,
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
      {isVisible && visible && (
        <div className={styles.footerRoot}>
          <div>
            <span className={styles.footerCountdown}>
              <RaceOverlayInfo
                username={username}
                raceStatus={raceInfo.raceStatus}
                timeLeftInMs={raceInfo.timeLeftInMs}
                laps={raceInfo.laps}
                averageLaps={raceInfo.averageLaps}
                currentLapTimeInMs={raceInfo.currentLapTimeInMs}
                raceFormat={raceFormat}
              />
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export { RaceInfoFooter };
