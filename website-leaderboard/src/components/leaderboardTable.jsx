import React, { useEffect, useState } from 'react';

import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Flag } from './flag';
import styles from './leaderboardTable.module.css';

const LeaderboardTable = ({ leaderboardEntries }) => {
  const { t } = useTranslation();
  const [leaderboardListItems, SetLeaderboardListItems] = useState(<div></div>);

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
    const items = leaderboardEntries.map((entry, index) => (
      <li
        key={entry.username}
        className={classnames(
          styles.listEntry,
          styles.moduleRow,
          index === 0 && styles.gold,
          index === 1 && styles.silver,
          index === 2 && styles.bronze
        )}
      >
        <div className={styles.liPosition}>#{index + 1}</div>
        <div
          className={classnames(
            [0, 1, 2].includes(index) && styles.topThreeLiRacer,
            ![0, 1, 2].includes(index) && styles.liRacer
          )}
        >
          <span className={styles.racerCountryFlag}>
            <Flag countryCode={entry.countryCode}/>
          </span>
          {entry.username}
          {entry.racedByProxy ? '*' : ''}
        </div>
        <div className={styles.liTime}>{convertMsToString(entry.fastestLapTime)}</div>
      </li>
    ));
    SetLeaderboardListItems(items);
  }, [leaderboardEntries]);

  return (
    <div className={styles.tableRoot}>
      <div className={styles.moduleHeaders}>
        <div className={styles.modulePosition}>{t('leaderboard.position')}</div>
        <div className={styles.moduleRacer}>{t('leaderboard.racer')}</div>
        <div className={styles.moduleResults}>{t('leaderboard.time')}</div>
      </div>
      <div className={styles.ulRoot}>
        <ul>{leaderboardListItems}</ul>
      </div>
    </div>
  );
};

export { LeaderboardTable };
