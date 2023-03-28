import * as d3 from 'd3';

export function SetEventName(eventName) {
  // console.log(`SETTING EVENT NAME TO: ${eventName}`);
  // Event Name on Leaderboard.
  const leaderboardObj = d3.select(document.getElementById('leaderboard').contentDocument);
  leaderboardObj.select('#LeaderboardUpperLeftTitleText').text(eventName);

  // Event Name on Lower Third.
  const racerAndLapInfoObj = d3.select(
    document.getElementById('lower-third-racer-and-lap-info').contentDocument
  );
  racerAndLapInfoObj.select('#EVENT_x5F_NAME').text(eventName);
}

export function SetFirstPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#FirstPlaceRacerNameText').text(racerName);
  racerAndLapInfoObj.select('#FirstPlaceLapTimeText').text(racerTime);
}

export function SetSecondPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#SecondPlaceRacerNameText').text(racerName);
  racerAndLapInfoObj.select('#SecondPlaceLapTimeText').text(racerTime);
}

export function SetThirdPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#ThirdPlaceRacerNameText').text(racerName);
  racerAndLapInfoObj.select('#ThirdPlaceLapTimeText').text(racerTime);
}

export function SetFourthPlaceRacerNameAndTime(racerName, racerTime) {
  // FirstPlaceRacerNameText
  const racerAndLapInfoObj = d3.select(document.getElementById('leaderboard').contentDocument);
  racerAndLapInfoObj.select('#FourthPlaceRacerNameText').text(racerName);
  racerAndLapInfoObj.select('#FourthPlaceLapTimeText').text(racerTime);
}

export function UpdateLeaderboard(leaderboardData) {
  SetFirstPlaceRacerNameAndTime('', '');
  SetSecondPlaceRacerNameAndTime('', '');
  SetThirdPlaceRacerNameAndTime('', '');
  SetFourthPlaceRacerNameAndTime('', '');

  if (leaderboardData.length > 0) {
    SetFirstPlaceRacerNameAndTime(
      leaderboardData[0].username,
      GetFormattedLapTime(leaderboardData[0].fastestLapTime, true)
    );
  }
  if (leaderboardData.length > 1) {
    SetSecondPlaceRacerNameAndTime(
      leaderboardData[1].username,
      GetFormattedLapTime(leaderboardData[1].fastestLapTime, true)
    );
  }
  if (leaderboardData.length > 2) {
    SetThirdPlaceRacerNameAndTime(
      leaderboardData[2].username,
      GetFormattedLapTime(leaderboardData[2].fastestLapTime, true)
    );
  }
  if (leaderboardData.length > 3) {
    SetFourthPlaceRacerNameAndTime(
      leaderboardData[3].username,
      GetFormattedLapTime(leaderboardData[3].fastestLapTime, true)
    );
  }
}

export function SetRacerInfoName(racerName) {
  const racerAndLapInfoObj = d3.select(
    document.getElementById('lower-third-racer-and-lap-info').contentDocument
  );
  racerAndLapInfoObj.select('#RACER_x5F_NAME').text(racerName);
}
export function SetRacerInfoFastestLap(bestTime) {
  const racerAndLapInfoObj = d3.select(
    document.getElementById('lower-third-racer-and-lap-info').contentDocument
  );
  racerAndLapInfoObj.select('#FASTEST_x5F_LAP_x5F_TIME').text(bestTime);
}
export function SetRacerInfoLastLap(lastTime) {
  const racerAndLapInfoObj = d3.select(
    document.getElementById('lower-third-racer-and-lap-info').contentDocument
  );
  racerAndLapInfoObj.select('#PREVIOUS_x5F_LAP_x5F_TIME').text(lastTime);
}
export function SetRacerInfoTotalTime(totalTimeRemaining) {
  const racerAndLapInfoObj = d3.select(
    document.getElementById('lower-third-racer-and-lap-info').contentDocument
  );
  racerAndLapInfoObj.select('#TOTAL_x5F_TIME_x5F_REMAINING').text(totalTimeRemaining);
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

export function GetLeaderboardDataSorted(entries) {
  entries.sort(function (a, b) {
    return a.fastestLapTime > b.fastestLapTime ? 1 : b.fastestLapTime > a.fastestLapTime ? -1 : 0;
  });

  return entries;
}

export function GetFormattedTotalTime(timeInMS) {
  // console.log(timeInMS)
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
