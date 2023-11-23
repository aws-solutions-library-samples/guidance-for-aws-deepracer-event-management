import {
  Container,
  ExpandableSection,
  FormField,
  Header,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AverageLapWindowConfig,
  GetAverageLapWindowFromId,
  GetMaxRunsPerRacerOptionFromId,
  GetRaceTimeOptionFromId,
  GetRankingOptionFromId,
  GetResetOptionFromId,
  GetTrackOptionFromId,
  MaxRunsPerRacerConfig,
  RaceTimeConfig,
  RaceTypeConfig,
  RaceTypeEnum,
  ResetConfig,
  TrackTypeConfig,
} from '../support-functions/raceConfig';

const RaceCustomizationsFooter = (props) => {
  const { t } = useTranslation();
  const [custIsExpanded, setCustIsExpanded] = useState(false);

  // Keep race customizations open after user click on included items
  const custIsExpandedHandler = () => {
    setCustIsExpanded((prevState) => !prevState);
  };

  return (
    <ExpandableSection
      headerText={t('events.race.race-customisations')}
      expanded={custIsExpanded}
      variant="footer"
      onChange={custIsExpandedHandler}
    >
      {props.children}
    </ExpandableSection>
  );
};

const DefaultRacingFooter = ({
  numberOfResetsPerLap,
  maxRunsPerRacer,
  maxRunsPerRacerOptions,
  averageLapsWindowConfig,
  averageLapsWindow,
  rankingMehtod,
  raceTimeInMin,
  onChange,
  raceTimeOptions,
  resetOptions,
}) => {
  const { t } = useTranslation();
  return (
    <SpaceBetween size="l">
      <FormField
        label={t('events.race.race-time')}
        description={t('events.race.race-time-description')}
      >
        <Select
          selectedOption={GetRaceTimeOptionFromId(raceTimeInMin)}
          onChange={({ detail }) => onChange({ raceTimeInMin: detail.selectedOption.value })}
          options={raceTimeOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
      <FormField
        label={t('events.race.resets-per-lap')}
        description={t('events.race.resets-per-lap-description')}
      >
        <Select
          selectedOption={GetResetOptionFromId(numberOfResetsPerLap)}
          onChange={({ detail }) => onChange({ numberOfResetsPerLap: detail.selectedOption.value })}
          options={resetOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
      <FormField
        label={t('events.race.allowed-races-per-racer-label')}
        description={t('events.race.allowed-races-per-racer-description')}
      >
        <Select
          selectedOption={GetMaxRunsPerRacerOptionFromId(maxRunsPerRacer)}
          onChange={({ detail }) => onChange({ maxRunsPerRacer: detail.selectedOption.value })}
          options={maxRunsPerRacerOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
      <FormField
        label={t('events.race.average-time-window-label')}
        description={t('events.race.average-time-window-description')}
      >
        <Select
          selectedOption={GetAverageLapWindowFromId(averageLapsWindow)}
          onChange={({ detail }) => onChange({ averageLapsWindow: detail.selectedOption.value })}
          options={averageLapsWindowConfig}
          selectedAriaLabel="Selected"
          filteringType="auto"
          disabled={rankingMehtod !== RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP}
        />
      </FormField>
    </SpaceBetween>
  );
};

export const RaceConfigPanel = ({ raceConfig, onChange }) => {
  const raceTimeOptions = RaceTimeConfig();
  const raceRankingOptions = RaceTypeConfig();
  const maxRunsPerRacerOptions = MaxRunsPerRacerConfig();
  const averageLapWindowConfig = AverageLapWindowConfig();
  //const
  const resetOptions = ResetConfig();
  const trackOptions = TrackTypeConfig();
  const { t } = useTranslation();
  const UpdateConfig = useCallback(
    (attr) => {
      const updatePayload = { raceConfig: { ...raceConfig, ...attr } };
      console.log(raceConfig);
      onChange(updatePayload);
    },
    [raceConfig, onChange]
  );
  const [raceCustomizationsFooter, setRaceCustomizationsFooter] = useState(
    <DefaultRacingFooter
      numberOfResetsPerLap={raceConfig.numberOfResetsPerLap}
      raceTimeInMin={raceConfig.raceTimeInMin}
      maxRunsPerRacer={raceConfig.maxRunsPerRacer}
      rankingMehtod={raceConfig.rankingMethod}
      averageLapsWindow={raceConfig.averageLapsWindow}
      onChange={UpdateConfig}
      resetOptions={resetOptions}
      raceTimeOptions={raceTimeOptions}
      maxRunsPerRacerOptions={maxRunsPerRacerOptions}
      averageLapsWindowConfig={averageLapWindowConfig}
    />
  );

  // Select race customizations footer
  useEffect(() => {
    setRaceCustomizationsFooter(
      <DefaultRacingFooter
        numberOfResetsPerLap={raceConfig.numberOfResetsPerLap}
        raceTimeInMin={raceConfig.raceTimeInMin}
        maxRunsPerRacer={raceConfig.maxRunsPerRacer}
        rankingMehtod={raceConfig.rankingMethod}
        averageLapsWindow={raceConfig.averageLapsWindow}
        onChange={UpdateConfig}
        resetOptions={resetOptions}
        raceTimeOptions={raceTimeOptions}
        maxRunsPerRacerOptions={maxRunsPerRacerOptions}
        averageLapsWindowConfig={averageLapWindowConfig}
      />
    );
    // }
  }, [UpdateConfig, raceConfig.numberOfResetsPerLap, raceConfig.raceTimeInMin]);

  // JSX
  return (
    <Container>
      <SpaceBetween size="xl">
        <Header variant="h2">Race Settings</Header>
        <FormField
          label={t('events.tracks.choose')}
          description={t('events.tracks.choose-description')}
        >
          <Select
            selectedOption={GetTrackOptionFromId(raceConfig.trackType)}
            onChange={({ detail }) => UpdateConfig({ trackType: detail.selectedOption.value })}
            options={trackOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>
        <FormField
          label={t('events.race.ranking-method')}
          description={t('events.race.ranking-method-description')}
        >
          <Select
            selectedOption={GetRankingOptionFromId(raceConfig.rankingMethod)}
            onChange={({ detail }) => UpdateConfig({ rankingMethod: detail.selectedOption.value })}
            options={raceRankingOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>

        <RaceCustomizationsFooter>{raceCustomizationsFooter}</RaceCustomizationsFooter>
      </SpaceBetween>
    </Container>
  );
};
