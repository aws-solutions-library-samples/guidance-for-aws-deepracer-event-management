import React, { useEffect, useState } from 'react';
import useInterval from '../hooks/useInterval';
import styles from './raceInfoFooter.module.css';
import { useTranslation } from 'react-i18next';

const displayUpdateInterval = 1000 / 30; // 30 fps

const RaceOverlayInfo = ({ username, raceStatus, timeLeftInMs, laps, currentLapTimeInMs }) => {
  const { t } = useTranslation();
  // raw timing values
  const [bestLapMs, setBestLapMs] = useState(0);
  const [currentLapMs, setCurrentLapMs] = useState(0);
  const [remainingTimeMs, setRemainingTimeMs] = useState(0);

  // displayed timing values
  const [bestLapDisplayTime, setBestLapDisplayTime] = useState({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });
  const [currentLapDisplayTime, setCurrentLapDisplayTime] = useState({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });

  const [remainingTimeDisplayTime, setRemainingTimeDisplayTime] = useState({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });

  const [lastDisplayUpdateTimestamp, setLastDisplayUpdateTimestamp] = useState(Date.now());

  const getFastestValidLap = (laps) => {
    // get lap with minimal lap time
    // use only valid laps
    const validLaps = laps.filter((lap) => lap.isValid);

    if (validLaps.length === 0) {
      return {
        time: 0,
      };
    }

    return validLaps.reduce((acc, cur) => {
      if (acc.time < cur.time) {
        return acc;
      } else {
        return cur;
      }
    });
  };

  const toTime = (time) => {
    let minutes = Math.floor(time / (1000 * 60));
    let seconds = Math.floor((time / 1000) % 60);
    let milliseconds = Math.floor(time % 1000);

    minutes = minutes.toString().padStart(2, '0');
    seconds = seconds.toString().padStart(2, '0');
    milliseconds = milliseconds.toString().padStart(3, '0');

    return {
      minutes,
      seconds,
      milliseconds,
    };
  };

  useEffect(() => {
    // Best lap time
    setBestLapMs(getFastestValidLap(laps).time);
  }, [laps]);

  useEffect(() => {
    // Current lap time
    setCurrentLapMs(currentLapTimeInMs);
  }, [currentLapTimeInMs]);

  useEffect(() => {
    // Time left
    setRemainingTimeMs(timeLeftInMs);
  }, [timeLeftInMs]);

  useEffect(() => {
    // update display times
    setBestLapDisplayTime(toTime(bestLapMs));
    setCurrentLapDisplayTime(toTime(currentLapMs));
    setRemainingTimeDisplayTime(toTime(remainingTimeMs));
  }, [bestLapMs, currentLapMs, remainingTimeMs]);

  // interpolate times between api updates
  useInterval(() => {
    // measure time passed since last update
    const timePassedMs = Date.now() - lastDisplayUpdateTimestamp;
    setLastDisplayUpdateTimestamp(Date.now());

    if (raceStatus === 'RACE_IN_PROGRESS') {
      // times should never be negative
      setRemainingTimeMs(Math.max(0, remainingTimeMs - timePassedMs));
      setCurrentLapMs(Math.max(0, currentLapMs + timePassedMs));
    }
  }, displayUpdateInterval);

  const htmlTable = (
    <table className={styles.tableRoot}>
      <thead>
        <tr>
          <th>
            <span className={styles.footerItemText}>{t('leaderboard.race-info-footer.time-remaining')}</span>
          </th>
          <th>
            <span className={styles.footerItemText}>{t('leaderboard.race-info-footer.best-lap')}</span>
          </th>
          <th>
            <span className={styles.footerItemText}>{t('leaderboard.race-info-footer.current-lap')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <span className={styles.footerItemDigits}>
              {remainingTimeDisplayTime.minutes}:{remainingTimeDisplayTime.seconds}:
              {remainingTimeDisplayTime.milliseconds.charAt(0)}
            </span>
          </td>
          <td>
            <span className={styles.footerItemDigits}>
              {bestLapDisplayTime.minutes}:{bestLapDisplayTime.seconds}:{bestLapDisplayTime.milliseconds}
            </span>
          </td>
          <td>
            <span className={styles.footerItemDigits}>
              {currentLapDisplayTime.minutes}:{currentLapDisplayTime.seconds}:
              {currentLapDisplayTime.milliseconds.charAt(0)}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <>
      <div className={styles.footerTop}>
        <span className={styles.footerItemText}>{t('leaderboard.race-info-footer.currently-racing')}</span>
        <span className={styles.footerItemDigits}>{username}</span>
      </div>
      <div className={styles.footerBottom}>{htmlTable}</div>
    </>
  );
};

export default RaceOverlayInfo;
