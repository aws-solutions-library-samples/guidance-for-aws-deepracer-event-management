import * as d3 from 'd3';

export function SetLocalizedLowerThirdsLabels(racerLabel, remainingLabel, fastestLabel, previousLabel) {
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);

  racerAndLapInfoObj.select('#RACER-LABEL').text(racerLabel);
  racerAndLapInfoObj.select('#REMAINING-LABEL').text(remainingLabel);
  racerAndLapInfoObj.select('#FASTEST-LABEL').text(fastestLabel);
  racerAndLapInfoObj.select('#PREVIOUS-LABEL').text(previousLabel);
}

export function SetLocalizedLeaderboardLabels(
  firstPlaceLabel,
  secondPlaceLabel,
  thirdPlaceLabel,
  fourthPlaceLabel,
  leaderboardLabel
) {
  const leaderboard = d3.select(document.getElementById('leaderboard').contentDocument);

  leaderboard.select('#FIRST-PLACE-RANK-LABEL').text(firstPlaceLabel);
  leaderboard.select('#SECOND-PLACE-RANK-LABEL').text(secondPlaceLabel);
  leaderboard.select('#THIRD-PLACE-RANK-LABEL').text(thirdPlaceLabel);
  leaderboard.select('#FOURTH-PLACE-RANK-LABEL').text(fourthPlaceLabel);
  leaderboard.select('#LEADERBOARD-LOWER-RIGHT-LABEL').text(leaderboardLabel);
}

export function SetEventName(eventName) {
  // console.debug(`SETTING EVENT NAME TO: ${eventName}`);
  // Event Name on Leaderboard.
  const leaderboardObj = d3.select(document.getElementById('leaderboard').contentDocument);
  leaderboardObj.select('#LeaderboardUpperLeftTitleText').text(eventName);

  // Event Name on Lower Third.
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);
  racerAndLapInfoObj.select('#EVENT-NAME-TEXT').text(eventName);
}

export function SetFirstPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#FIRST-PLACE-RACER-NAME-TEXT').text(racerName);
  racerAndLapInfoObj.select('#FIRST-PLACE-LAP-TIME-TEXT').text(racerTime);
}

export function SetSecondPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#SECOND-PLACE-RACER-NAME-TEXT').text(racerName);
  racerAndLapInfoObj.select('#SECOND-PLACE-LAP-TIME-TEXT').text(racerTime);
}

export function SetThirdPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#THIRD-PLACE-RACER-NAME-TEXT').text(racerName);
  racerAndLapInfoObj.select('#THIRD-PLACE-LAP-TIME-TEXT').text(racerTime);
}

export function SetFourthPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#FOURTH-PLACE-RACER-NAME-TEXT').text(racerName);
  racerAndLapInfoObj.select('#FOURTH-PLACE-LAP-TIME-TEXT').text(racerTime);
}

const GetFormattedLapTimeForRaceFormat = (leaderboardDataEntry, raceFormat, isMilliseconds) => {
  if (raceFormat === 'average') {
    return leaderboardDataEntry.fastestAverageLap
      ? GetFormattedLapTime(leaderboardDataEntry.fastestAverageLap.avgTime, isMilliseconds)
      : 'DNF';
  } else {
    return GetFormattedLapTime(leaderboardDataEntry.fastestLapTime, true);
  }
};

export function UpdateLeaderboard(leaderboardData, raceFormat) {
  SetFirstPlaceRacerNameAndTime('', '');
  SetSecondPlaceRacerNameAndTime('', '');
  SetThirdPlaceRacerNameAndTime('', '');
  SetFourthPlaceRacerNameAndTime('', '');

  if (leaderboardData.length > 0) {
    const GetFormattedLapTime = SetFirstPlaceRacerNameAndTime(
      leaderboardData[0].username,
      GetFormattedLapTimeForRaceFormat(leaderboardData[0], raceFormat, true)
    );
  }
  if (leaderboardData.length > 1) {
    SetSecondPlaceRacerNameAndTime(
      leaderboardData[1].username,
      GetFormattedLapTimeForRaceFormat(leaderboardData[1], raceFormat, true)
    );
  }
  if (leaderboardData.length > 2) {
    SetThirdPlaceRacerNameAndTime(
      leaderboardData[2].username,
      GetFormattedLapTimeForRaceFormat(leaderboardData[2], raceFormat, true)
    );
  }
  if (leaderboardData.length > 3) {
    SetFourthPlaceRacerNameAndTime(
      leaderboardData[3].username,
      GetFormattedLapTimeForRaceFormat(leaderboardData[3], raceFormat, true)
    );
  }
}

export function SetRacerInfoName(racerName) {
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);
  racerAndLapInfoObj.select('#RACER-NAME-TEXT').text(racerName);
}
export function SetRacerInfoFastestLap(bestTime) {
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);
  racerAndLapInfoObj.select('#FASTEST-LAP-TIME-TEXT').text(bestTime);
}
export function SetRacerInfoLastLap(lastTime) {
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);
  racerAndLapInfoObj.select('#PREVIOUS-LAP-TIME-TEXT').text(lastTime);
}
export function SetRacerInfoTotalTime(totalTimeRemaining) {
  const racerAndLapInfoObj = d3.select(document.getElementById('lower-third-racer-and-lap-info').contentDocument);
  racerAndLapInfoObj.select('#TOTAL-TIME-REMAINING-TEXT').text(totalTimeRemaining);
}

export function SetDRCarPosition(x, y) {
  const trackOverlay = d3.select(document.getElementById('track-overlay').contentDocument);
  trackOverlay.select('#DR_x5F_CAR').attr('cx', x).attr('cy', y);
}

export function getLeaderboardData(entries) {
  let leaderboardEntries = entries.split('\n');
  let leaderboardTempData = [];
  leaderboardEntries.forEach((entry) => {
    let racerStats = entry.split('|');
    leaderboardTempData.push({
      RacerName: racerStats[2],
      RacerTime: GetFormattedLapTime(racerStats[1], true),
      RacerColor: racerStats[0],
      RacerTimeMS: parseInt(racerStats[1]),
    });
  });

  leaderboardTempData.sort(function (a, b) {
    return a.RacerTimeMS > b.RacerTimeMS ? 1 : b.RacerTimeMS > a.RacerTimeMS ? -1 : 0;
  });

  return leaderboardTempData;
}

export function GetLeaderboardDataSorted(entries, raceFormat) {
  if (raceFormat === 'average') {
    entries.sort(function (a, b) {
      if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
      if (!a.fastestAverageLap) return 1;
      if (!b.fastestAverageLap) return -1;
      return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
    });
  } else {
    entries.sort(function (a, b) {
      return a.fastestLapTime > b.fastestLapTime ? 1 : b.fastestLapTime > a.fastestLapTime ? -1 : 0;
    });
  }

  return entries;
}

export function GetFormattedTotalTime(timeInMS) {
  // console.debug(timeInMS)
  if (timeInMS < 0) {
    return '00:00.0';
  }

  var min = Math.floor(timeInMS / 1000 / 60);
  var sec = Math.floor(timeInMS / 1000 - min * 60);
  var ms = timeInMS - (min * 60 * 1000 + sec * 1000);
  return `${PadZero(min)}:${PadZero(sec)}.${String(ms).slice(0, 1)}`;
}

export function GetFormattedLapTime(timeInMS, showMinutes = false) {
  if (timeInMS === 999999999) return '00.000';
  var sec = 0;
  var ms = 0;

  if (showMinutes) {
    var min = Math.floor(timeInMS / 1000 / 60);
    sec = Math.floor(timeInMS / 1000) - min * 60; // - (min * 60));
    ms = String(timeInMS - (min * 60 * 1000 + sec * 1000));
    //    return `${PadZero(min)}:${PadZero(sec)}:${ms}`
    return `${PadZero(min)}:${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
  } else {
    //    var min = Math.floor(timeInMS / 1000 / 60);
    sec = Math.floor(timeInMS / 1000); // - (min * 60));
    ms = String(timeInMS - sec * 1000); //((min * 60 * 1000) + (sec * 1000)));
    //    return `${PadZero(min)}:${PadZero(sec)}:${ms}`
    return `${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
  }
}

export function PadZero(number) {
  if (number < 10) {
    return `0${number}`;
  } else {
    return number;
  }
}

export function PadZeroMS(number) {
  if (number < 10) {
    return `00${number}`;
  } else if (number < 100) {
    return `0${number}`;
  } else {
    return number;
  }
}

export function checkMin(min) {
  if (min < 10 && min >= 0) {
    min = '0' + min;
  } // add zero in front of numbers < 10
  if (min < 0) {
    min = '00';
  }
  return min;
}

export function checkSecond(sec) {
  if (sec < 10 && sec >= 0) {
    sec = '0' + sec;
  } // add zero in front of numbers < 10
  if (sec < 0) {
    sec = '59';
  }
  return sec;
}
