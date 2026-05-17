import React, { useEffect, useRef, useState } from 'react';

import Avatar from 'avataaars';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useWindowSize } from '../hooks/useWindowSize';
import positionRank from '../positionRank';
import { convertMsToString } from '../support-functions/time';
import { scrollTo } from '../utils';
import { Flag } from './flag';
import styles from './leaderboardTable.module.css';
import { parseAvatarConfig } from './parseAvatarConfig';

interface LeaderboardTableProps {
  leaderboardEntries: any[];
  scrollEnabled: boolean;
  fastest: boolean;
  showFlag: boolean;
  highlightedUsername?: string | null;
  summaryFooterVisible?: boolean;
}

// After a race submission, the table scrolls to the racer and highlights them
// for 12s (parent owns that timer). After a longer interval we scroll back to
// the top so the broadcast view doesn't sit showing mid-table for the next
// 10-minute auto-scroll cycle.
const SCROLL_BACK_TO_TOP_MS = 60_000;

const LeaderboardTable = ({
  leaderboardEntries,
  scrollEnabled,
  fastest,
  showFlag,
  highlightedUsername = null,
  summaryFooterVisible = false,
}: LeaderboardTableProps) => {
  const { t } = useTranslation();
  const [leaderboardListItems, SetLeaderboardListItems] = useState<React.ReactNode>(<div></div>);
  const entriesRef = useRef<HTMLDivElement | null>(null);
  const backToTopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSize = useWindowSize();
  const aspectRatio = (windowSize.width ?? 0) / (windowSize.height ?? 1);

  const ScrollTo = ({ duration, toRef }: { duration: number; toRef: any }) => {
    return scrollTo({ ref: toRef, duration });
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
        } else if (aspectRatio < 1.2 && username.length > 20) username = username.substr(0, 20) + '...';
      }

      let timeValue = t('leaderboard.DNF');
      if (fastest) {
        timeValue = convertMsToString(entry.fastestLapTime);
      } else if (entry.fastestAverageLap) {
        timeValue = convertMsToString(entry.fastestAverageLap.avgTime);
      }

      const avatarConfig = parseAvatarConfig(entry.profile?.avatarConfig);
      const isHighlighted = highlightedUsername && entry.username === highlightedUsername;

      return (
        <div
          key={entry.username}
          id={String(index)}
          data-username={entry.username}
          className={classnames(
            styles.listEntry,
            styles.row,
            styles.row,
            index === 0 && styles.gold,
            index === 1 && styles.silver,
            index === 2 && styles.bronze,
            isHighlighted && styles.highlighted
          )}
          style={{
            marginTop: `calc(${positionRank(index)}vmin)`,
          }}
        >
          <div className={styles.liPosition}>#{index + 1}</div>
          {avatarConfig && entry.profile?.highlightColour && (
            <div
              className={styles.highlightBar}
              style={{
                background: `linear-gradient(to right, ${entry.profile?.highlightColour} 50%, transparent)`,
              }}
            />
          )}
          {(avatarConfig || (showFlag && entry.countryCode)) && (
            <div className={styles.liIdentity}>
              {avatarConfig ? (
                <>
                  <Avatar avatarStyle="Transparent" {...(avatarConfig as Record<string, string>)} />
                  {showFlag && entry.countryCode && (
                    <span className={styles.identityFlag}>
                      <Flag countryCode={entry.countryCode} />
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.identityFlagOnly}>
                  <Flag countryCode={entry.countryCode} />
                </span>
              )}
            </div>
          )}
          <div
            className={classnames(
              [0, 1, 2].includes(index) && styles.topThreeLiRacer,
              ![0, 1, 2].includes(index) && styles.liRacer
            )}
          >
            {username}
            {entry.racedByProxy ? '*' : ''}
          </div>
          <div className={styles.liTime}>{timeValue}</div>
        </div>
      );
    });
    SetLeaderboardListItems(items);
  }, [leaderboardEntries, aspectRatio, highlightedUsername]);

  // Scroll to the highlighted entry whenever the highlight or the list items
  // change. The list-items dep is required: a brand-new finisher is added to
  // the entries state in the same React batch as the highlight, but the row
  // doesn't exist in the DOM until items render — re-running the effect on
  // leaderboardListItems lets us find it on that second pass.
  useEffect(() => {
    if (!highlightedUsername || !entriesRef.current) return;

    const el = entriesRef.current.querySelector(`[data-username="${highlightedUsername}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedUsername, leaderboardListItems]);

  // Schedule the back-to-top scroll in a separate effect on highlightedUsername
  // alone, with the timer held in a ref. This is intentional: the previous
  // implementation hung the timer off the scroll-to-highlight effect's
  // cleanup, which fired (and cancelled the timer) every time the highlight
  // ended at 12s or the items list re-rendered — so the back-to-top never ran.
  // The timer should restart only when a new highlight begins.
  useEffect(() => {
    if (!highlightedUsername) return;

    if (backToTopTimerRef.current) clearTimeout(backToTopTimerRef.current);
    backToTopTimerRef.current = setTimeout(() => {
      entriesRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      backToTopTimerRef.current = null;
    }, SCROLL_BACK_TO_TOP_MS);
  }, [highlightedUsername]);

  useEffect(
    () => () => {
      if (backToTopTimerRef.current) clearTimeout(backToTopTimerRef.current);
    },
    []
  );

  /* optional hide the scrollbar, but then lose visuals of progress */
  useEffect(() => {
    let timer;
    let interval;
    if (scrollEnabled === true) {
      // 👇️ scroll to bottom of leaderboard

      const timeOutBeforeScroll = 600000; // start scrolling every 10 min = 600000ms
      interval = setInterval(() => {
        const scrollTimeDuration = leaderboardEntries.length * 1000;

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
        <div className={styles.timeTitle}>{t(fastest ? 'leaderboard.time' : 'leaderboard.average')}</div>
      </div>
      <div
        ref={entriesRef}
        className={classnames(styles.entries, summaryFooterVisible && styles.entriesWithFooter)}
      >
        <div id="entries" className={styles.entry}>
          {leaderboardListItems}
        </div>
      </div>
    </div>
  );
};
export { LeaderboardTable };
