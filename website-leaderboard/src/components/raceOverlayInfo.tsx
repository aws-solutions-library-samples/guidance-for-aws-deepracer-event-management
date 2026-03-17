import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useInterval from '../hooks/useInterval';
import styles from './raceInfoFooter.module.css';

const displayUpdateInterval = 1000 / 30; // 30 fps

interface TimeDisplay {
  minutes: string;
  seconds: string;
  milliseconds: string;
}

interface AvgLap {
  avgTime: number;
  startLapId: number;
  endLapId: number;
  dnf: boolean;
}

interface RaceOverlayInfoProps {
  username: any;
  raceStatus: any;
  timeLeftInMs: any;
  laps: any;
  averageLaps: any;
  currentLapTimeInMs: any;
  raceFormat: any;
}

const RaceOverlayInfo = ({
  username,
  raceStatus,
  timeLeftInMs,
  laps,
  averageLaps,
  currentLapTimeInMs,
  raceFormat,
}: RaceOverlayInfoProps) => {
  const { t } = useTranslation();
  // raw timing values
  const [bestLapMs, setBestLapMs] = useState(0);
  const [bestAvgMs, setBestAvgMs] = useState(0);
  const [fastestAvgLap, setFastestAvgLap] = useState<AvgLap>({ avgTime: 0, startLapId: 0, endLapId: 0, dnf: true });
  const [currentLapMs, setCurrentLapMs] = useState(0);
  const [remainingTimeMs, setRemainingTimeMs] = useState(0);

  // displayed timing values
  const [bestLapDisplayTime, setBestLapDisplayTime] = useState<TimeDisplay>({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });

  const [bestAvgDisplayTime, setBestAvgDisplayTime] = useState<TimeDisplay & { startLapId: number; endLapId: number; dnf: boolean }>({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
    startLapId: 0,
    endLapId: 0,
    dnf: true,
  });

  const [currentLapDisplayTime, setCurrentLapDisplayTime] = useState<TimeDisplay>({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });

  const [remainingTimeDisplayTime, setRemainingTimeDisplayTime] = useState<TimeDisplay>({
    minutes: '0',
    seconds: '0',
    milliseconds: '0',
  });

  const [lastDisplayUpdateTimestamp, setLastDisplayUpdateTimestamp] = useState(Date.now());

  const getFastestValidLap = (laps: any[]) => {
    // get lap with minimal lap time
    // use only valid laps
    const validLaps = laps.filter((lap: any) => lap.isValid);

    if (validLaps.length === 0) {
      return {
        time: 0,
      };
    }

    return validLaps.reduce((acc: any, cur: any) => {
      if (acc.time < cur.time) {
        return acc;
      } else {
        return cur;
      }
    });
  };

  const getFastestAverageLap = (averageLaps: any[]): AvgLap => {
    // get average lap with minimal average lap time
    if (averageLaps.length === 0) {
      return {
        avgTime: 0,
        startLapId: 0,
        endLapId: 0,
        dnf: true,
      };
    }

    return averageLaps.reduce((acc: any, cur: any) => {
      if (acc.avgTime < cur.avgTime) {
        return acc;
      } else {
        return cur;
      }
    });
  };

  const toTime = (time: number): TimeDisplay => {
    const mins = Math.floor(time / (1000 * 60));
    const secs = Math.floor((time / 1000) % 60);
    const ms = Math.floor(time % 1000);

    return {
      minutes: mins.toString().padStart(2, '0'),
      seconds: secs.toString().padStart(2, '0'),
      milliseconds: ms.toString().padStart(3, '0'),
    };
  };

  useEffect(() => {
    // Best lap time
    setBestLapMs(getFastestValidLap(laps).time);
  }, [laps]);

  useEffect(() => {
    // Average lap time
    setFastestAvgLap(getFastestAverageLap(averageLaps));
  }, [averageLaps]);

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
    setBestAvgDisplayTime({
      ...toTime(fastestAvgLap.avgTime),
      startLapId: fastestAvgLap.startLapId,
      endLapId: fastestAvgLap.endLapId,
      dnf: fastestAvgLap.dnf,
    });
    setCurrentLapDisplayTime(toTime(currentLapMs));
    setRemainingTimeDisplayTime(toTime(remainingTimeMs));
  }, [bestLapMs, currentLapMs, fastestAvgLap, remainingTimeMs]);

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

  const bestLaptimeSpan = (
    <span className={styles.footerItemDigits}>
      {bestLapDisplayTime.minutes}:{bestLapDisplayTime.seconds}:{bestLapDisplayTime.milliseconds}
    </span>
  );

  const avgLaps2 = (
    <>
      ({bestAvgDisplayTime.startLapId + 1} - {bestAvgDisplayTime.endLapId + 1})
    </>
  );

  const bestAvgSpan = (
    <span className={styles.footerItemDigits}>
      {bestAvgDisplayTime.minutes}:{bestAvgDisplayTime.seconds}:{bestAvgDisplayTime.milliseconds}{' '}
      {bestAvgDisplayTime.dnf ? '' : avgLaps2}
    </span>
  );

  const htmlTable = (
    <table className={styles.tableRoot}>
      <thead>
        <tr>
          <th>
            <span className={styles.footerItemText}>{t('leaderboard.race-info-footer.time-remaining')}</span>
          </th>
          <th>
            <span className={styles.footerItemText}>
              {raceFormat === 'average'
                ? t('leaderboard.race-info-footer.best-avg')
                : t('leaderboard.race-info-footer.best-lap')}
            </span>
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
          <td>{raceFormat === 'average' ? bestAvgSpan : bestLaptimeSpan}</td>
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