import { Race } from '../../../types';

// Note: We use the API response shape here, not the domain Lap type.
// The GraphQL API returns laps with { time, resets, isValid } fields,
// and there is no transformation layer before data reaches this function.
interface ApiLap {
    time: number;
    resets?: number;
    isValid: boolean;
    [key: string]: unknown;
}

interface LapSummary {
    resets: number | null;
    laps: number | null;
    slowestTime: number | null;
    fasestTime: number | null;
    timeSum: number | null;
}

export interface RaceMetrics {
    numberOfUniqueRacers: number | null;
    numberOfRaces: number | null;
    mostNumberOfRacesByUser: number | null;
    avgRacesPerUser: string | null;
    totalLaps: number | null;
    totalresets: number | null;
    avgresestsPerLap: string | null;
    avgLapsPerRace: string | null;
    avgLapTime: number | null;
    fastestLap: number | null;
    slowestLap: number | null;
}

const getRaceSummary = (lapsPerRace: (ApiLap[] | undefined)[]): LapSummary => {
    const allLaps = lapsPerRace.flat().filter((lap): lap is ApiLap => lap !== undefined);

    return allLaps.reduce(
        (prevValue, lap) => {
            if (lap.isValid) {
                let slowestTime = lap.time;
                let fasestTime = lap.time;

                if (prevValue.slowestTime != null) {
                    slowestTime =
                        prevValue.slowestTime < lap.time ? lap.time : prevValue.slowestTime;
                } else {
                    slowestTime = lap.time;
                }
                if (prevValue.fasestTime != null) {
                    fasestTime = prevValue.fasestTime > lap.time ? lap.time : prevValue.fasestTime;
                } else {
                    fasestTime = lap.time;
                }

                return {
                    resets:
                        prevValue.resets != null
                            ? prevValue.resets + (lap.resets || 0)
                            : lap.resets || 0,
                    laps: prevValue.laps != null ? prevValue.laps + 1 : 1,
                    slowestTime: slowestTime,
                    fasestTime: fasestTime,
                    timeSum: prevValue.timeSum != null ? prevValue.timeSum + lap.time : lap.time,
                };
            }
            return prevValue;
        },
        {
            resets: null,
            laps: null,
            slowestTime: null,
            fasestTime: null,
            timeSum: null,
        } as LapSummary
    );
};

export const calculateMetrics = (races: Race[]): RaceMetrics => {
    const userIdsForAllRaces = races.map((item) => item.userId);
    const numberOfUniqueRacers = userIdsForAllRaces.filter(
        (value, index, self) => self.indexOf(value) === index
    ).length;

    const numberOfRacesByUserId = userIdsForAllRaces.reduce<Record<string, number>>(
        (acc, userId) => {
            return (acc[userId] ? ++acc[userId] : (acc[userId] = 1), acc);
        },
        {}
    );

    const mostNumberOfRacesByUser = Math.max(...Object.values(numberOfRacesByUserId));

    const numberOfRaces = races.length;

    // Cast to ApiLap[] because at runtime the API returns { time, resets, isValid }
    // but the domain Lap type incorrectly declares { lapTime, resetCount }
    const lapsPerRace = races.map((race) =>
        race.laps ? (race.laps as unknown as ApiLap[]) : undefined
    );
    if (lapsPerRace.length > 0) {
        const summary = getRaceSummary(lapsPerRace);

        if (summary.laps && summary.laps > 0) {
            return {
                numberOfUniqueRacers: numberOfUniqueRacers,
                numberOfRaces: numberOfRaces,
                mostNumberOfRacesByUser: mostNumberOfRacesByUser,
                avgRacesPerUser: (numberOfRaces / numberOfUniqueRacers).toFixed(1),
                totalLaps: summary.laps,
                totalresets: summary.resets,
                avgresestsPerLap:
                    summary.resets !== null && summary.laps !== null
                        ? (summary.resets / summary.laps).toFixed(1)
                        : null,
                avgLapsPerRace: (summary.laps / numberOfRaces).toFixed(1),
                avgLapTime:
                    summary.timeSum !== null && summary.laps !== null
                        ? parseInt(String(summary.timeSum / summary.laps))
                        : null,
                fastestLap: summary.fasestTime,
                slowestLap: summary.slowestTime,
            };
        }
    }
    return {
        numberOfUniqueRacers: null,
        numberOfRaces: null,
        mostNumberOfRacesByUser: null,
        avgRacesPerUser: null,
        totalLaps: null,
        totalresets: null,
        avgresestsPerLap: null,
        avgLapsPerRace: null,
        avgLapTime: null,
        fastestLap: null,
        slowestLap: null,
    };
};
