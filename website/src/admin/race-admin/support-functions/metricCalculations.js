const getRaceSummary = (lapsPerRace) => {
  const allLaps = lapsPerRace.flat();

  return allLaps.reduce(
    (prevValue, lap) => {
      if (lap.isValid) {
        let slowestTime = lap.time;
        let fasestTime = lap.time;

        if (prevValue.slowestTime != null) {
          slowestTime = prevValue.slowestTime < lap.time ? lap.time : prevValue.slowestTime;
        } else {
          slowestTime = lap.time;
        }
        if (prevValue.fasestTime != null) {
          fasestTime = prevValue.fasestTime > lap.time ? lap.time : prevValue.fasestTime;
        } else {
          fasestTime = lap.time;
        }

        return {
          resets: prevValue.resets != null ? prevValue.resets + lap.resets : lap.resets,
          laps: prevValue.laps != null ? prevValue.laps + 1 : 1,
          slowestTime: slowestTime,
          fasestTime: fasestTime,
          timeSum: prevValue.timeSum != null ? prevValue.timeSum + lap.time : lap.time,
        };
      }
      return prevValue;
    },
    { resets: null, laps: null, slowestTime: null, fasestTime: null, timeSum: null }
  );
};

export const calculateMetrics = (races) => {
  const userIdsForAllRaces = races.map((item) => item.userId);
  const numberOfUniqueRacers = userIdsForAllRaces.filter(
    (value, index, self) => self.indexOf(value) === index
  ).length;

  const numberOfRacesByUserId = userIdsForAllRaces.reduce((acc, userId) => {
    return acc[userId] ? ++acc[userId] : (acc[userId] = 1), acc;
  }, {});

  const mostNumberOfRacesByUser = Math.max(...Object.values(numberOfRacesByUserId));

  const numberOfRaces = races.length;

  const lapsPerRace = races.map((race) => (race.laps ? race.laps : undefined));
  if (lapsPerRace.length > 0) {
    const summary = getRaceSummary(lapsPerRace);

    return {
      numberOfUniqueRacers: numberOfUniqueRacers,
      numberOfRaces: numberOfRaces,
      mostNumberOfRacesByUser: mostNumberOfRacesByUser,
      avgRacesPerUser: (numberOfRaces / numberOfUniqueRacers).toFixed(1),
      totalLaps: summary.laps,
      totalresets: summary.resets,
      avgresestsPerLap: (summary.resets / summary.laps).toFixed(1),
      avgLapsPerRace: (summary.laps / numberOfRaces).toFixed(1),
      avgLapTime: parseInt(summary.timeSum / summary.laps),
      fastestLap: summary.fasestTime,
      slowestLap: summary.slowestTime,
    };
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
