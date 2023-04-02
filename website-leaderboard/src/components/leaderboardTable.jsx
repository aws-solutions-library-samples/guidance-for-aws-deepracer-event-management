import { default as React, useEffect, useRef, useState } from 'react';

import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useWindowSize } from '../hooks/useWindowSize';
import positionRank from '../positionRank';
import { scrollTo } from '../utils';
import { Flag } from './flag';
import styles from './leaderboardTable.module.css';

const LeaderboardTable = ({ leaderboardEntries, scrollEnabled }) => {
  const { t } = useTranslation();
  const [leaderboardListItems, SetLeaderboardListItems] = useState(<div></div>);
  const entriesRef = useRef(null);
  const windowSize = useWindowSize();
  const aspectRatio = windowSize.width / windowSize.height;

  const ScrollTo = ({ toId, toRef, duration, children }) => {
    return scrollTo({ id: toId, ref: toRef, duration });
  };

  const convertMsToString = (timeInMS) => {
    const millisecondsAsString = String(Math.floor(timeInMS % 1000)).padStart(3, '0');
    const secondsAsString = String(Math.floor(timeInMS / 1000)).padStart(2, '0');
    const seconds = Math.floor(timeInMS / 1000);
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    const timeAsString = `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
    return timeAsString;
  };

  // Update the leaderboard list
  useEffect(() => {
    console.debug('Update leaderboard list items');

    const items = leaderboardEntries.map((entry, index) => {
      let username = entry.username;

      if (index < 3) {
        if (aspectRatio < 1.2 && username.length > 15) {
          username = username.substr(0, 9) + '...';
        }
      } else {
        if (aspectRatio > 1.2 && username.length > 30) {
          username = username.substr(0, 30) + '...';
        } else if (aspectRatio < 1.2 && username.length > 20)
          username = username.substr(0, 20) + '...';
      }

      return (
        <div
          key={entry.username}
          id={index}
          className={classnames(
            styles.listEntry,
            styles.row,
            styles.row,
            index === 0 && styles.gold,
            index === 1 && styles.silver,
            index === 2 && styles.bronze
          )}
          style={{
            marginTop: `calc(${positionRank(index)}vmin)`,
          }}
        >
          <div className={styles.liPosition}>#{index + 1}</div>
          <div
            className={classnames(
              [0, 1, 2].includes(index) && styles.topThreeLiRacer,
              ![0, 1, 2].includes(index) && styles.liRacer
            )}
          >
            <span className={styles.racerCountryFlag}>
              <Flag countryCode={entry.countryCode} />
            </span>
            {username}
            {entry.racedByProxy ? '*' : ''}
          </div>
          <div className={styles.liTime}>{convertMsToString(entry.fastestLapTime)}</div>
        </div>
      );
    });
    SetLeaderboardListItems(items);
  }, [leaderboardEntries, aspectRatio]);

  /* optional hide the scrollbar, but then lose visuals of progress */
  useEffect(() => {
    let timer;
    let interval;
    if (scrollEnabled === true) {
      // 👇️ scroll to bottom of leaderboard

      const timeOutBeforeScroll = 600000; // start scrolling every 10 min = 600000ms
      interval = setInterval(() => {
        const scrollTimeDuration = 25000;

        ScrollTo({ duration: scrollTimeDuration, toRef: entriesRef });
      }, timeOutBeforeScroll);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [scrollEnabled]);

  return (
    <div className={styles.layout}>
      <div className={styles.titles}>
        <div className={styles.positionTitle}>{t('leaderboard.position')}</div>
        <div className={styles.racerTitle}>{t('leaderboard.racer')}</div>
        <div className={styles.timeTitle}>{t('leaderboard.time')}</div>
      </div>
      <div ref={entriesRef} className={styles.entries}>
        <div id="entries" className={styles.entry}>
          {leaderboardListItems}
        </div>
      </div>
    </div>
  );
};
export { LeaderboardTable };
