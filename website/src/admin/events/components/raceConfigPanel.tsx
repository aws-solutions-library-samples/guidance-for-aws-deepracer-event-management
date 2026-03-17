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
import { RaceConfig } from '../../../types/domain';
import {
  AverageLapWindowConfig,
  ConfigOption,
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

/**
 * Props for RaceCustomizationsFooter component
 */
interface RaceCustomizationsFooterProps {
  children: React.ReactNode;
}

/**
 * Props for DefaultRacingFooter component
 */
interface DefaultRacingFooterProps {
  numberOfResetsPerLap?: string;
  maxRunsPerRacer?: string;
  maxRunsPerRacerOptions: ConfigOption[];
  averageLapsWindowConfig: ConfigOption[];
  averageLapsWindow?: string;
  rankingMehtod?: string;
  raceTimeInMin?: string;
  onChange: (attr: Partial<RaceConfig>) => void;
  raceTimeOptions: ConfigOption[];
  resetOptions: ConfigOption[];
}

/**
 * Props for RaceConfigPanel component
 */
interface RaceConfigPanelProps {
  raceConfig: RaceConfig;
  onChange: (update: { raceConfig: RaceConfig }) => void;
}

const RaceCustomizationsFooter: React.FC<RaceCustomizationsFooterProps> = ({ children }) => {
  const { t } = useTranslation();
  const [custIsExpanded, setCustIsExpanded] = useState<boolean>(false);

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
      {children}
    </ExpandableSection>
  );
};

const DefaultRacingFooter: React.FC<DefaultRacingFooterProps> = ({
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
          selectedOption={GetRaceTimeOptionFromId(raceTimeInMin) || null}
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
          selectedOption={GetResetOptionFromId(numberOfResetsPerLap) || null}
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
          selectedOption={GetMaxRunsPerRacerOptionFromId(maxRunsPerRacer) || null}
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
          selectedOption={GetAverageLapWindowFromId(averageLapsWindow) || null}
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

export const RaceConfigPanel: React.FC<RaceConfigPanelProps> = ({ raceConfig, onChange }) => {
  const raceTimeOptions = RaceTimeConfig();
  const raceRankingOptions = RaceTypeConfig();
  const maxRunsPerRacerOptions = MaxRunsPerRacerConfig();
  const averageLapWindowConfig = AverageLapWindowConfig();
  const resetOptions = ResetConfig();
  const trackOptions = TrackTypeConfig();
  const { t } = useTranslation();
  
  const UpdateConfig = useCallback(
    (attr: Partial<RaceConfig>) => {
      const updatePayload = { raceConfig: { ...raceConfig, ...attr } };
      console.log(raceConfig);
      onChange(updatePayload);
    },
    [raceConfig, onChange]
  );
  
  const [raceCustomizationsFooter, setRaceCustomizationsFooter] = useState<React.ReactNode>(
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
  }, [
    UpdateConfig,
    raceConfig.numberOfResetsPerLap,
    raceConfig.raceTimeInMin,
    raceConfig.maxRunsPerRacer,
    raceConfig.rankingMethod,
    raceConfig.averageLapsWindow,
    resetOptions,
    raceTimeOptions,
    maxRunsPerRacerOptions,
    averageLapWindowConfig,
  ]);

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
            selectedOption={GetTrackOptionFromId(raceConfig.trackType) || null}
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
            selectedOption={GetRankingOptionFromId(raceConfig.rankingMethod) || null}
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
