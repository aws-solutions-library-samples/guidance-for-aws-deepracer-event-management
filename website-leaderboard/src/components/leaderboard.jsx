import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import Logo from '../assets/logo.png';
import { getLeaderboard } from '../graphql/queries';
import { onNewLeaderboardEntry } from '../graphql/subscriptions';
import { FollowFooter } from './followFooter';
import { Header } from './header';
import styles from './leaderboard.module.css';
import { LeaderboardTable } from './leaderboardTable';
import { RaceInfoFooter } from './raceInfoFooter';
import { RaceSummaryFooter } from './raceSummaryFooter';

const Leaderboard = ({ eventId, trackId }) => {
    const [leaderboardEntries, SetleaderboardEntries] = useState([]);
    const [headerText, SetHeaderText] = useState([]);
    const [subscription, SetSubscription] = useState();

    const [racSummaryFooterIsVisible, SetraceSummaryFooterIsVisible] = useState(false);
    const [raceSummaryData, SetRaceSummaryData] = useState({
        racerName: undefined,
        overallRank: undefined,
        consistency: undefined,
        gapToFastest: undefined,
        fastestTime: undefined,
        avgLapTime: undefined,
        lapCompletionRation: undefined,
        avgLapsPerAttempt: undefined,
    });

    const [followFooterText, SetFollowFooterText] = useState('');

    useEffect(() => {
        if (eventId) {
            const getLeaderboardData = async () => {
                const response = await API.graphql(
                    graphqlOperation(getLeaderboard, { eventId: eventId, trackId: trackId })
                );
                const leaderboard = response.data.getLeaderboard;
                SetleaderboardEntries(leaderboard.entries);
                SetFollowFooterText(leaderboard.config.footerText);
                SetHeaderText(leaderboard.config.headerText);
            };
            getLeaderboardData();

            if (subscription) {
                subscription.unsubscribe();
            }
            SetSubscription(
                API.graphql(
                    graphqlOperation(onNewLeaderboardEntry, { eventId: eventId })
                ).subscribe({
                    next: ({ provider, value }) => {
                        const newEntry = value.data.onNewLeaderboardEntry;
                        updateLeaderboardEntries(newEntry);
                        SetraceSummaryFooterIsVisible(true);
                        setTimeout(() => {
                            SetraceSummaryFooterIsVisible(false);
                        }, 10000);
                    },
                    error: (error) => console.warn(error),
                })
            );

            return () => {
                if (subscription) {
                    subscription.unsubscribe();
                }
            };
        }
    }, [eventId]);

    const findEntryByUsername = (username, allEntries) => {
        console.info(allEntries);
        const index = allEntries.findIndex((entry) => entry.username === username);
        if (index !== -1) {
            const entry = allEntries[index];
            return [index, entry];
        }
        return [undefined, undefined];
    };
    const updateLeaderboardEntries = (newLeaderboardEntry) => {
        SetleaderboardEntries((prevState) => {
            const usernameToUpdate = newLeaderboardEntry.username;
            let newState = [...prevState];

            // Find user to update on leaderboard, if user exist
            const [oldEntryIndex, oldEntry] = findEntryByUsername(usernameToUpdate, prevState);
            console.info(oldEntryIndex);
            console.info(oldEntry);
            if (oldEntryIndex) {
                newState[oldEntryIndex] = newLeaderboardEntry;
            } else {
                newState = prevState.concat(newLeaderboardEntry);
            }

            // sort list according to fastestLapTime, ascending order
            const sortedLeaderboard = newState.sort((a, b) => a.fastestLapTime - b.fastestLapTime);
            const oldPosition = oldEntryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
            calcRaceSummary(newLeaderboardEntry, oldPosition, sortedLeaderboard);
            return sortedLeaderboard;
        });
    };

    const calcRaceSummary = (newEntry, previousPostition, allEntries) => {
        //calculate overall rank (current leaderboard position)
        const [entryIndex] = findEntryByUsername(newEntry.username, allEntries);
        const overallRank = entryIndex + 1; // +1 due to that list index start from 0 and leaderboard on 1
        newEntry.overallRank = overallRank;
        console.info(overallRank);

        // calculate consistency (previous leaderboard position)
        console.info(previousPostition);
        if (previousPostition) {
            newEntry.consistency = previousPostition;
        } else {
            newEntry.consistency = newEntry.overallRank;
        }
        console.info(newEntry.consistency);

        //calculate gap to fastest
        if (overallRank === 0) {
            newEntry.gapToFastest = 0;
        } else {
            newEntry.gapToFastest = newEntry.fastestLapTime - allEntries[0].fastestLapTime;
        }
        SetRaceSummaryData(newEntry);
    };

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
                        <Header headerText={headerText} />
                        <LeaderboardTable leaderboardEntries={leaderboardEntries} />
                    </div>
                    <FollowFooter visible text={followFooterText} />
                    <RaceInfoFooter eventId={eventId} />
                    <RaceSummaryFooter visible={racSummaryFooterIsVisible} {...raceSummaryData} />
                </div>
            )}
        </>
    );
};

export { Leaderboard };
