import { GraphQLResult, GraphQLSubscription } from '@aws-amplify/api';
import { API, Amplify, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import * as queries from './graphql/queries.js';
import * as subscriptions from './graphql/subscriptions.js';
import * as helpers from './helperFunctions.js';
import './init.js';
import * as transitions from './transitions.js';

import './i18n';

import { useTranslation } from 'react-i18next';

import './App.css';
import awsExports from './config.json';
Amplify.configure(awsExports);

function App() {

  var timerState: any = false;
  var isPaused: boolean = false;
  var currentTotalTimerMS: number = 180000;
  var currentTotalTimer: string;
  var leaderBoardStateIN: boolean = false;
  var lowerThirdStateIN: boolean = false;
  var shouldShowChromaBackground: boolean = false;
  var chromaBgColor: string = '00ff00';

  const { t, i18n } = useTranslation();

  const [searchParams] = useSearchParams();
  const { eventId } = useParams();

  const desiredLanguage = searchParams.get("lang")?.toString();

  let trackId = searchParams.get("trackId")?.toString();
  if (typeof trackId === "undefined") {
    trackId = "1";
  }

  let showLeaderboard = searchParams.get("showLeaderboard")?.toString();
  if (typeof showLeaderboard === "undefined") {
    showLeaderboard = "1";
  }

  let raceFormat = searchParams.get("format")?.toString();
  if (typeof raceFormat === "undefined") {
    raceFormat = "fastest";
  }

  const startTimer = () => {
    if (!timerState || isPaused) {
      return;
    }

    currentTotalTimerMS = currentTotalTimerMS - 100;
    currentTotalTimer = helpers.GetFormattedTotalTime(currentTotalTimerMS);

    (helpers as any).SetRacerInfoTotalTime(currentTotalTimer)

    // if total time remaining drops below zero, reset to zero and stop timer.
    if (currentTotalTimerMS <= 0) {
      timerState = false;
      currentTotalTimerMS = 0;
    }

    if (timerState) {
      setTimeout(startTimer, 100);
    }

  }

  const resetTimer = () => {
    timerState = false;
    currentTotalTimer = "03:00.0";
    currentTotalTimerMS = 180000;
  }

  const getFastestLap = (laps: any[]) => {
    return laps.filter(item => item.isValid)
      .sort((a, b) => {
        if (a.time < b.time) {
          return -1;
        }
        if (a.time > b.time) {
          return 1;
        }
        return 0;
      })[0].time;
  }

  interface AvgLap {avgTime: number, startLapId: number, endLapId: number}

  const getFastestAvgLap = (avgLaps: AvgLap[]): AvgLap  => {
    return avgLaps.sort((a, b) => {
      if (a.avgTime < b.avgTime) {
        return -1;
      }
      if (a.avgTime > b.avgTime) {
        return 1;
      }
      return 0;
    })[0]
  }

  const updateLeaderboard = (leaderboardEntries: any[]) => {
    const leaderboardData = (helpers as any).GetLeaderboardDataSorted(leaderboardEntries, raceFormat);
    helpers.UpdateLeaderboard(leaderboardData, raceFormat);
  }

  function onMessageReceived(message: any) {

    try {
      var data = message;

      data.paused = data.raceStatus === 'RACE_PAUSED';
      data.finished = data.raceStatus === 'RACE_FINSIHED';
      data.running = data.raceStatus === 'RACE_IN_PROGRESS';

      if (data.username) {
        // console.debug('competitor found!');
        // console.debug('TimerState: ' + timerState);

        if (leaderBoardStateIN) {
          // console.debug('fade out leaderboard');
          (transitions as any).LeaderboardFadeOut();
          leaderBoardStateIN = false;
        }

        if (!lowerThirdStateIN) {
          // console.debug('transition IN lower third.');
          setTimeout(() => {
            (transitions as any).LowerThirdRacerAndLapInfoIn();
            lowerThirdStateIN = true;

            // TODO: Change fastest-lap to fastest AVG when AVG Race (Issue with spacing)
            const fastestLabel = raceFormat === 'average' ? t('lower-thirds.fastest-avg-lap') : t('lower-thirds.fastest-lap')

            helpers.SetLocalizedLowerThirdsLabels(t('lower-thirds.racer-name'), t('lower-thirds.time-remaining'), fastestLabel, t('lower-thirds.previous-lap'));
          }, 2000);
        }

        var oldPauseState = isPaused;
        isPaused = data.paused;
        // console.debug(`Old Paused: ${oldPauseState}, New Paused: ${isPaused}`);

        if (oldPauseState && !data.paused && !data.finished && data.running) {
          // console.debug("RESUMING TIMER!");
          timerState = true;
          startTimer();
        }
        // console.debug(`DATA.PAUSED: ${data.paused} !!!!!!!!!!!!!!!!!!!!!!!!!`);

        if (data.finished) {
          // console.debug('FINISHED, RESET TIMER!');
          // resetTimer();

          if (lowerThirdStateIN) {
            // console.debug('Lower Third OUT!');
            (transitions as any).LowerThirdRacerAndLapInfoOut();
            lowerThirdStateIN = false;

            // console.debug('Setting TimeOut to remove racer info from lower third.');
            setTimeout(() => {
              (helpers as any).SetRacerInfoName("");
              (helpers as any).SetRacerInfoFastestLap("00.000");
              (helpers as any).SetRacerInfoLastLap("00.000");
              (helpers as any).SetRacerInfoTotalTime(180000);
              // console.debug(`CURRENT TIMER STATE: ${timerState}`);
              if (timerState) {
                timerState = false;
                resetTimer();
              }
            }, 2000);
          }

          if (!leaderBoardStateIN && showLeaderboard === '1') {
            // console.debug('Setting TimeOut to fade Leaderboard in!');
            helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
            setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
          }
        }

        if (!timerState && data.running) {
          // console.debug('Timer Not Running, set state to true and start timer.');
          timerState = true;
          startTimer();
        }

        var racer = data.username;
        (helpers as any).SetRacerInfoName(racer);
        // console.debug("Racer: " + racer)

        var timeLeft = data.timeLeftInMs;
        // console.debug('Total Time Remaining: ' + (helpers as any).GetFormattedTotalTime(timeLeft));
        (helpers as any).SetRacerInfoTotalTime((helpers as any).GetFormattedTotalTime(timeLeft));
        currentTotalTimerMS = timeLeft;

        if (data.laps) {
          var fastestLap
          if(raceFormat === 'average') {
            if(data.averageLaps && data.averageLaps.length > 0) {
              fastestLap = getFastestAvgLap(data.averageLaps).avgTime;
            }
          } else {
            fastestLap = getFastestLap(data.laps);
          }

          if (fastestLap) {
            // console.debug('Fastest Lap: ' + (helpers as any).GetFormattedLapTime(fastestLap.time));
            (helpers as any).SetRacerInfoFastestLap((helpers as any).GetFormattedLapTime(fastestLap))
          }

          // console.debug(data.laps);

          var laps = (data.laps as any[]).filter(obj => {
            return obj.isValid
          });

          var lastLap = laps
            .filter(item => item.isValid)
            .sort((a, b) => {
              if (a.lapId > b.lapId) {
                return -1;
              }
              if (a.lapId < b.lapId) {
                return 1;
              }
              return 0;
            })[0];

          if (lastLap) {
            // console.debug('Last Lap: ' + (helpers as any).GetFormattedLapTime(lastLap.time));
            (helpers as any).SetRacerInfoLastLap((helpers as any).GetFormattedLapTime(lastLap.time));
          }
        }
      }
      else if ('competitor' in data && data.competitor === null) {
        // console.debug('Competitor NOT FOUND!');

        if (lowerThirdStateIN) {
          // console.debug('Lower Third OUT!');
          (transitions as any).LowerThirdRacerAndLapInfoOut();
          lowerThirdStateIN = false;

          // console.debug('Setting TimeOut to remove racer info from lower third.');
          setTimeout(() => {
            (helpers as any).SetRacerInfoName("");
            (helpers as any).SetRacerInfoFastestLap("00.000");
            (helpers as any).SetRacerInfoLastLap("00.000");
            (helpers as any).SetRacerInfoTotalTime(180000);
            // console.debug(`CURRENT TIMER STATE: ${timerState}`);
            if (timerState) {
              timerState = false;
              resetTimer();
            }
          }, 2000);
        }

        if (!leaderBoardStateIN && showLeaderboard === '1') {
          // console.debug('Setting TimeOut to fade Leaderboard in!');
          helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
          setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
        }
      }
      // else if ('previous' in data && 'current' in data) {
      //   // event name info
      //   // console.debug('Event Config');
      //   // console.debug(data.current.state.reported.config);
      //   eventName = data.current.state.reported.config.localName === "" ? data.current.state.reported.config.name : data.current.state.reported.config.localName;
      //   console.debug(`EVENT NAME SET TO: ${eventName}`);
      //   (helpers as any).SetEventName(eventName.toUpperCase());

      //   // leaderboard data.
      //   console.debug(data.current.state.reported.entries);
      //   leaderboardData = (helpers as any).getLeaderboardData(data.current.state.reported.entries);

      //   (helpers as any).SetFirstPlaceRacerNameAndTime('', '');
      //   (helpers as any).SetSecondPlaceRacerNameAndTime('', '');
      //   (helpers as any).SetThirdPlaceRacerNameAndTime('', '');
      //   (helpers as any).SetFourthPlaceRacerNameAndTime('', '');

      //   (helpers as any).SetFirstPlaceRacerNameAndTime(leaderboardData[0].RacerName, leaderboardData[0].RacerTime);
      //   (helpers as any).SetSecondPlaceRacerNameAndTime(leaderboardData[1].RacerName, leaderboardData[1].RacerTime);
      //   (helpers as any).SetThirdPlaceRacerNameAndTime(leaderboardData[2].RacerName, leaderboardData[2].RacerTime);
      //   (helpers as any).SetFourthPlaceRacerNameAndTime(leaderboardData[3].RacerName, leaderboardData[3].RacerTime);
      // }
      // else if ('state' in data && 'metadata' in data) { // this is initial state message.
      //   leaderboardData = (helpers as any).getLeaderboardData(data.state.reported.entries);
      //   let eventMsgConfig = data.state.reported.config;
      //   console.debug(eventMsgConfig);
      //   eventName = eventMsgConfig.localName === "" ? eventMsgConfig.name : eventMsgConfig.localName;
      //   console.debug(`EVENT NAME SET TO: ${eventName}`);
      //   (helpers as any).SetEventName(eventName.toUpperCase());
      // }
    } catch (e) {
      console.debug("error! " + e);
    }
  }

  // react component to show/hide based on query string "chroma=1" being present.
  function ChromaBG(props: any) {
    shouldShowChromaBackground = searchParams.get("chroma") === "1" ? true : false;
    chromaBgColor = searchParams.get("chromaColor") || '00ff00';
    if (chromaBgColor.length > 6) {
      chromaBgColor = '00ff00'; // someone tries to cross-site script, override with default green.
    }

    if (shouldShowChromaBackground) {
      return <div id="chromaBg" style={{ backgroundColor: `#${chromaBgColor}` }}></div>
    }
    else {
      return <div />
    }
  }

  useEffect(() => {

    // set desired language
    if (searchParams.get("lang") !== null) {
      console.debug("CHANGING LANGUAGE TO: " + desiredLanguage);
      i18n.changeLanguage(desiredLanguage);
    }

    // Set Localized Labels
    // helpers.SetLocalizedLowerThirdsLabels(t('lower-thirds.racer-name'), t('lower-thirds.time-remaining'), t('lower-thirds.fastest-lap'), t('lower-thirds.previous-lap'));

    // fetch current leaderboard state on-load.
    const apiGetLeaderboardState = API.graphql({
      query: queries.getLeaderboard,
      variables: {
        eventId: eventId,
        trackId: trackId,
      },
    }) as Promise<GraphQLResult<any>>

    // once leaderboard data has been obtained, set all leaderboard positions in SVGs.
    apiGetLeaderboardState.then((response) => {
      
      const leaderboardConfig = response.data.getLeaderboard.config;
      updateLeaderboard(response.data.getLeaderboard.entries);

      (helpers as any).SetEventName(leaderboardConfig.leaderBoardTitle.toUpperCase());

      // check if lower thirds is showing, if not, then show leaderboard.
      if (!lowerThirdStateIN && showLeaderboard === '1') {
        // console.debug('Setting TimeOut to fade Leaderboard in!');
        helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
        setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
      }
    });

    // subscribe to "obNewOverlayInfo" to receive live messages for in progress race data.
    const overlaySubscription = (API.graphql<GraphQLSubscription<any>>(
      graphqlOperation(subscriptions.onNewOverlayInfo, { eventId: eventId, trackId: trackId })) as any
    ).subscribe({
      next: ({ provider, value }: any) => {
        const raceInfo = value.data.onNewOverlayInfo;
        if (raceInfo.eventName) {
          (helpers as any).SetEventName(raceInfo.eventName);
        }
        if(raceInfo.raceStatus !== 'RACE_SUBMITTED') {
          onMessageReceived(raceInfo);
        }
      },
      error: (error: any) => console.error(error),
    });

    // subscribe to "onNewLeaderboardEntry" so that we can refresh the leaderboard data when a race is "submitted"
    const leaderboardSubscription = (API.graphql<GraphQLSubscription<any>>(
      graphqlOperation(subscriptions.onNewLeaderboardEntry, { eventId: eventId, trackId: trackId })) as any
    ).subscribe({
      next: ({ provider, value }: any) => {

        // when a new race is submitted, fetch latest leaderboard data
        const apiResponse = API.graphql({
          query: queries.getLeaderboard,
          variables: {
            eventId: eventId,
            trackId: trackId,
          },
        }) as Promise<GraphQLResult<any>>

        // once leaderboard data is set, update the leaderboard SVG.
        apiResponse.then((response) => {
          updateLeaderboard(response.data.getLeaderboard.entries)
        });
      },
      error: (error: any) => console.error(error),
    });

    // subscribe to "onDeleteLeaderboardEntry" to make sure leaderboard is updated when an entry is removed.
    const deleteLeaderboardSubscription = (API.graphql<GraphQLSubscription<any>>(
      graphqlOperation(subscriptions.onDeleteLeaderboardEntry, { eventId: eventId, trackId: trackId })) as any
    ).subscribe({
      next: ({ provider, value }: any) => {

        const apiResponse = API.graphql({
          query: queries.getLeaderboard,
          variables: {
            eventId: eventId,
            trackId: trackId,
          },
        }) as Promise<GraphQLResult<any>>

        // once leaderboard data is set, update the leaderboard SVG.
        apiResponse.then((response) => {
          const leaderboardData = (helpers as any).GetLeaderboardDataSorted(response.data.getLeaderboard.entries);
          (helpers as any).UpdateLeaderboard(leaderboardData);
        });
      },
      error: (error: any) => console.error(error),
    });

    return () => {
      if (overlaySubscription) {
        overlaySubscription.unsubscribe();
      }
      if (leaderboardSubscription) {
        leaderboardSubscription.unsubscribe();
      }
      if (deleteLeaderboardSubscription) {
        deleteLeaderboardSubscription.unsubscribe();
      }
    };
  }, [i18n, desiredLanguage]);

  return (
    <div className="App">
      <ChromaBG />
      <div id="racerAndInfo">
        <object type="image/svg+xml" data={ raceFormat === "fastest" ? "assets/svg/RacerAndLapInfo-Localized.svg" : "assets/svg/RacerAndLapInfo-BestAvg.svg" }id="lower-third-racer-and-lap-info">Lower Thirds SVG</object>
      </div>

      <div id="track-overlay-frame">
        <object type="image/svg+xml" data="assets/svg/re-invent-2018-track-overlay-white.svg" id="track-overlay">Track Overlay SVG</object>
      </div>

      <div id="leaderboard-frame">
        <object type="image/svg+xml" data="assets/svg/LeaderboardWithBackdrop-Wide.svg" id="leaderboard">Leaderboard SVG</object>
      </div>

      <div id="did-you-know-frame">
        <img src="assets/svg/DidYouKnowWithBackdrop.svg" id="did-you-know" alt="Did You Know SVG" />
      </div>
    </div>
  );
}

export default App;
