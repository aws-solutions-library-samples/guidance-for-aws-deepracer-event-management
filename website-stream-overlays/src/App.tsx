import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
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

/**
 * Legacy config shape produced by generate_stream_overlays_amplify_config_cfn.py
 * We map this to Amplify v6 ResourcesConfig at runtime so the CDK scripts
 * don't need to change.
 */
interface LegacyStreamOverlaysConfig {
  API: {
    aws_appsync_graphqlEndpoint: string;
    aws_appsync_region: string;
    aws_appsync_authenticationType: string;
    aws_appsync_apiKey: string;
  };
}

/** Map legacy config.json → Amplify v6 ResourcesConfig */
function buildAmplifyConfig(legacy: LegacyStreamOverlaysConfig): ResourcesConfig {
  return {
    API: {
      GraphQL: {
        endpoint: legacy.API.aws_appsync_graphqlEndpoint,
        region: legacy.API.aws_appsync_region,
        defaultAuthMode: 'apiKey',
        apiKey: legacy.API.aws_appsync_apiKey,
      },
    },
  };
}

Amplify.configure(buildAmplifyConfig(awsExports as LegacyStreamOverlaysConfig));

const client = generateClient();

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

        if (leaderBoardStateIN) {
          (transitions as any).LeaderboardFadeOut();
          leaderBoardStateIN = false;
        }

        if (!lowerThirdStateIN) {
          setTimeout(() => {
            (transitions as any).LowerThirdRacerAndLapInfoIn();
            lowerThirdStateIN = true;

            const fastestLabel = raceFormat === 'average' ? t('lower-thirds.fastest-avg-lap') : t('lower-thirds.fastest-lap')

            helpers.SetLocalizedLowerThirdsLabels(t('lower-thirds.racer-name'), t('lower-thirds.time-remaining'), fastestLabel, t('lower-thirds.previous-lap'));
          }, 2000);
        }

        var oldPauseState = isPaused;
        isPaused = data.paused;

        if (oldPauseState && !data.paused && !data.finished && data.running) {
          timerState = true;
          startTimer();
        }

        if (data.finished) {

          if (lowerThirdStateIN) {
            (transitions as any).LowerThirdRacerAndLapInfoOut();
            lowerThirdStateIN = false;

            setTimeout(() => {
              (helpers as any).SetRacerInfoName("");
              (helpers as any).SetRacerInfoFastestLap("00.000");
              (helpers as any).SetRacerInfoLastLap("00.000");
              (helpers as any).SetRacerInfoTotalTime(180000);
              if (timerState) {
                timerState = false;
                resetTimer();
              }
            }, 2000);
          }

          if (!leaderBoardStateIN && showLeaderboard === '1') {
            helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
            setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
          }
        }

        if (!timerState && data.running) {
          timerState = true;
          startTimer();
        }

        var racer = data.username;
        (helpers as any).SetRacerInfoName(racer);

        var timeLeft = data.timeLeftInMs;
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
            (helpers as any).SetRacerInfoFastestLap((helpers as any).GetFormattedLapTime(fastestLap))
          }

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
            (helpers as any).SetRacerInfoLastLap((helpers as any).GetFormattedLapTime(lastLap.time));
          }
        }
      }
      else if ('competitor' in data && data.competitor === null) {

        if (lowerThirdStateIN) {
          (transitions as any).LowerThirdRacerAndLapInfoOut();
          lowerThirdStateIN = false;

          setTimeout(() => {
            (helpers as any).SetRacerInfoName("");
            (helpers as any).SetRacerInfoFastestLap("00.000");
            (helpers as any).SetRacerInfoLastLap("00.000");
            (helpers as any).SetRacerInfoTotalTime(180000);
            if (timerState) {
              timerState = false;
              resetTimer();
            }
          }, 2000);
        }

        if (!leaderBoardStateIN && showLeaderboard === '1') {
          helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
          setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
        }
      }
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

    // fetch current leaderboard state on-load.
    const apiGetLeaderboardState = client.graphql({
      query: queries.getLeaderboard,
      variables: {
        eventId: eventId,
        trackId: trackId,
      },
    }) as any;

    // once leaderboard data has been obtained, set all leaderboard positions in SVGs.
    (apiGetLeaderboardState as Promise<any>).then((response: any) => {
      
      const leaderboardConfig = response.data.getLeaderboard.config;
      updateLeaderboard(response.data.getLeaderboard.entries);

      (helpers as any).SetEventName(leaderboardConfig.leaderBoardTitle.toUpperCase());

      // check if lower thirds is showing, if not, then show leaderboard.
      if (!lowerThirdStateIN && showLeaderboard === '1') {
        helpers.SetLocalizedLeaderboardLabels(t('leaderboard.first-place'), t('leaderboard.second-place'), t('leaderboard.third-place'), t('leaderboard.fourth-place'),t('leaderboard.lower-text'))
        setTimeout(() => { (transitions as any).LeaderboardFadeIn(); leaderBoardStateIN = true; }, 2000);
      }
    });

    // subscribe to "onNewOverlayInfo" to receive live messages for in progress race data.
    const overlaySubscription = (client
      .graphql({
        query: subscriptions.onNewOverlayInfo,
        variables: { eventId: eventId, trackId: trackId },
      }) as any)
      .subscribe({
        next: ({ data }: any) => {
          const raceInfo = data.onNewOverlayInfo;
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
    const leaderboardSubscription = (client
      .graphql({
        query: subscriptions.onNewLeaderboardEntry,
        variables: { eventId: eventId, trackId: trackId },
      }) as any)
      .subscribe({
        next: () => {

          // when a new race is submitted, fetch latest leaderboard data
          const apiResponse = client.graphql({
            query: queries.getLeaderboard,
            variables: {
              eventId: eventId,
              trackId: trackId,
            },
          }) as any;

          // once leaderboard data is set, update the leaderboard SVG.
          (apiResponse as Promise<any>).then((response: any) => {
            updateLeaderboard(response.data.getLeaderboard.entries)
          });
        },
        error: (error: any) => console.error(error),
      });

    // subscribe to "onDeleteLeaderboardEntry" to make sure leaderboard is updated when an entry is removed.
    const deleteLeaderboardSubscription = (client
      .graphql({
        query: subscriptions.onDeleteLeaderboardEntry,
        variables: { eventId: eventId, trackId: trackId },
      }) as any)
      .subscribe({
        next: () => {

          const apiResponse = client.graphql({
            query: queries.getLeaderboard,
            variables: {
              eventId: eventId,
              trackId: trackId,
            },
          }) as any;

          // once leaderboard data is set, update the leaderboard SVG.
          (apiResponse as Promise<any>).then((response: any) => {
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