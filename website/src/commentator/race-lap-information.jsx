import { Grid } from '@cloudscape-design/components';
import Container from '@cloudscape-design/components/container';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LapTable } from '../pages/timekeeper/components/lapTable';
import { RaceGraph } from './race-graph';
import { getFacestAvgFromOverlayInfo } from './support-functions';

const RaceLapInformation = ({ overlayInformation, selectedEvent, sortedLeaderboard }) => {
  const { t } = useTranslation();

  const [laps, SetLaps] = useState({});
  const [thresholds, setThresholds] = useState({});
  const [fastestRaceAvgLap, SetFastestRaceAvgLap] = useState({});

  const updateUI = (overlayInfo) => {
    SetLaps(overlayInfo.laps);
    SetFastestRaceAvgLap(getFacestAvgFromOverlayInfo(overlayInfo));
  };

  useEffect(() => {
    console.debug('Leaderboard: ', sortedLeaderboard);
    if (sortedLeaderboard?.length > 0) {
      const fastest = sortedLeaderboard[0];
      setThresholds(fastest);
    }
  }, [sortedLeaderboard]);

  useLayoutEffect(() => {
    const raceStatus = overlayInformation.raceStatus;
    switch (raceStatus) {
      case 'READY_TO_START':
      case 'RACE_IN_PROGRESS':
      case 'RACE_PAUSED':
      default:
        updateUI(overlayInformation);
        break;
      case 'NO_RACER_SELECTED':
        //reset UI
        break;
      case 'RACE_FINSIHED':
    }
  }, [overlayInformation]);

  return (
    <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
      <Container>
        <LapTable
          variant="embedded"
          header={t('timekeeper.recorded-laps')}
          laps={laps}
          averageLapInformation={overlayInformation.averageLaps}
          rankingMethod={selectedEvent.raceConfig.rankingMethod}
          readonly={true}
        />
      </Container>
      <Container>
        <RaceGraph
          laps={laps}
          fastestEventLapTime={thresholds.fastestLapTime}
          fastestEventAvgLap={thresholds.fastestAverageLap}
          raceFormat={selectedEvent.raceConfig.rankingMethod}
          fastestRaceAvgLap={fastestRaceAvgLap}
        ></RaceGraph>
      </Container>
    </Grid>
  );
};

export { RaceLapInformation };
