import * as d3 from 'd3';

var currentTotalTimer = "03:00.0";
var currentTotalTimerMS = 180000
var timerState = false;
var isPaused = false;

function SetEventName(eventName) {
    console.log(`SETTING EVENT NAME TO: ${eventName}`);
    // Event Name on Leaderboard.
    const leaderboardObj = d3.select(document.getElementById("leaderboard-frame").contentDocument);
    leaderboardObj.select("#LeaderboardUpperLeftTitleText").text(eventName);

    // Event Name on Lower Third.
    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#EVENT_x5F_NAME").text(eventName);
  }

  function SetFirstPlaceRacerNameAndTime(racerName, racerTime) {
    // FirstPlaceRacerNameText
    const racerAndLapInfoObj = d3.select(document.getElementById("leaderboard-frame").contentDocument);
    racerAndLapInfoObj.select("#FirstPlaceRacerNameText").text(racerName);
    racerAndLapInfoObj.select("#FirstPlaceLapTimeText").text(racerTime);
  }

  function SetSecondPlaceRacerNameAndTime(racerName, racerTime) {
    // FirstPlaceRacerNameText
    const racerAndLapInfoObj = d3.select(document.getElementById("leaderboard-frame").contentDocument);
    racerAndLapInfoObj.select("#SecondPlaceRacerNameText").text(racerName);
    racerAndLapInfoObj.select("#SecondPlaceLapTimeText").text(racerTime);
  }

  function SetThirdPlaceRacerNameAndTime(racerName, racerTime) {
    // FirstPlaceRacerNameText
    const racerAndLapInfoObj = d3.select(document.getElementById("leaderboard-frame").contentDocument);
    racerAndLapInfoObj.select("#ThirdPlaceRacerNameText").text(racerName);
    racerAndLapInfoObj.select("#ThirdPlaceLapTimeText").text(racerTime);
  }

  function SetFourthPlaceRacerNameAndTime(racerName, racerTime) {
    // FirstPlaceRacerNameText
    const racerAndLapInfoObj = d3.select(document.getElementById("leaderboard-frame").contentDocument);
    racerAndLapInfoObj.select("#FourthPlaceRacerNameText").text(racerName);
    racerAndLapInfoObj.select("#FourthPlaceLapTimeText").text(racerTime);
  }


  function SetRacerInfoName(racerName) {
    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#RACER_x5F_NAME").text(racerName);
  }
  function SetRacerInfoFastestLap(bestTime) {
    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#FASTEST_x5F_LAP_x5F_TIME").text(bestTime);
  }
  function SetRacerInfoLastLap(lastTime) {
    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#PREVIOUS_x5F_LAP_x5F_TIME").text(lastTime);
  }
  function SetRacerInfoTotalTime(totalTimeRemaining) {
    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#TOTAL_x5F_TIME_x5F_REMAINING").text(totalTimeRemaining);
  }

  function SetDRCarPosition(x, y) {
    const trackOverlay = d3.select(document.getElementById("track-overlay").contentDocument);
    trackOverlay.select("#DR_x5F_CAR").attr("cx", x).attr("cy", y);
  }

  function getLeaderboardData(entries) {
    let leaderboardEntries = entries.split('\n');
    let leaderboardTempData = [];
    leaderboardEntries.forEach(entry => {
      let racerStats = entry.split('|');
      leaderboardTempData.push({
        'RacerName': racerStats[2],
        'RacerTime': GetFormattedLapTime(racerStats[1], true),
        'RacerColor': racerStats[0],
        'RacerTimeMS': parseInt(racerStats[1])
      });
    });

    leaderboardTempData.sort(function(a,b) {return (a.RacerTimeMS > b.RacerTimeMS) ? 1 : ((b.RacerTimeMS > a.RacerTimeMS) ? -1 : 0);} );

    return leaderboardTempData
  }

  function GetFormattedTotalTime(timeInMS) {

    if (timeInMS < 0) {
      return '00:00.0';
    }

    var min = Math.floor(timeInMS / 1000 / 60);
    var sec = Math.floor((timeInMS / 1000) - (min * 60));
    var ms = (timeInMS - ((min * 60 * 1000) + (sec * 1000)));
    return `${PadZero(min)}:${PadZero(sec)}.${String(ms).slice(0,1)}`
  }

  function GetFormattedLapTime(timeInMS, showMinutes = false) {
    if (timeInMS == 999999999)
    return '00.000';

    if (showMinutes) {
      var min = Math.floor(timeInMS / 1000 / 60);
      var sec = Math.floor((timeInMS / 1000)) - (min * 60); // - (min * 60));
      var ms = String(timeInMS - ((min * 60 * 1000) + (sec * 1000)));
      //    return `${PadZero(min)}:${PadZero(sec)}:${ms}`
      return `${PadZero(min)}:${PadZero(sec)}.${PadZeroMS(ms).slice(0,3)}`
    }
    else {
      //    var min = Math.floor(timeInMS / 1000 / 60);
      var sec = Math.floor((timeInMS / 1000)); // - (min * 60));
      var ms = String(timeInMS - (sec * 1000)); //((min * 60 * 1000) + (sec * 1000)));
      //    return `${PadZero(min)}:${PadZero(sec)}:${ms}`
      return `${PadZero(sec)}.${PadZeroMS(ms).slice(0,3)}`
    }
  }

  function PadZero(number) {
    if (number < 10) {
      return `0${number}`;
    }
    else {
      return number;
    }
  }

  function PadZeroMS(number) {
    if (number < 10) {
      return `00${number}`;
    }
    else if (number < 100) {
      return `0${number}`;
    }
    else {
      return number;
    }
  }


function startTimer() {
    if (!timerState || isPaused) {
    return;
    }

    currentTotalTimerMS = currentTotalTimerMS - 100;

    currentTotalTimer = GetFormattedTotalTime(currentTotalTimerMS);

    const racerAndLapInfoObj = d3.select(document.getElementById("lower-third-racer-and-lap-info").contentDocument);
    racerAndLapInfoObj.select("#TOTAL_x5F_TIME_x5F_REMAINING").text(currentTotalTimer);

    if (currentTotalTimer <= 0) {
    timerState = false;
    currentTotalTimerMS = 0;
    }

    if (timerState) {
    setTimeout(startTimer, 100);
    }

}

function checkMin(min) {
    if (min < 10 && min >= 0) {min = "0" + min}; // add zero in front of numbers < 10
    if (min < 0) {min = "00"};
    return min;
}

function checkSecond(sec) {
    if (sec < 10 && sec >= 0) {sec = "0" + sec}; // add zero in front of numbers < 10
    if (sec < 0) {sec = "59"};
    return sec;
}

function resetTimer() {
    timerState = false;
    currentTotalTimer = "03:00.0";
    currentTotalTimerMS = 180000;
}