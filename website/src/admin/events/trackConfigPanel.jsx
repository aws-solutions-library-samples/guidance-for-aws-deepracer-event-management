import {
  Container,
  ExpandableSection,
  FormField,
  Header,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GetRaceTimeOptionFromId,
  GetRankingOptionFromId,
  GetResetOptionFromId,
  GetTrackOptionFromId,
  RaceTimeConfig,
  RaceTypeConfig,
  ResetConfig,
  TrackTypeConfig,
} from './raceConfig';

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
    </SpaceBetween>
  );
};

export const TrackConfigPanel = ({
  trackId,
  numberOfResetsPerLap,
  raceTimeInMin,
  trackType,
  rankingMethod,
  onChange,
}) => {
  const raceTimeOptions = RaceTimeConfig();
  const raceRankingOptions = RaceTypeConfig();
  const resetOptions = ResetConfig();
  const trackOptions = TrackTypeConfig();
  const { t } = useTranslation();

  const UpdateConfig = (attr) => {
    onChange({ raceConfig: { ...attr } });
  };

  const [raceCustomizationsFooter, setRaceCustomizationsFooter] = useState(
    <DefaultRacingFooter
      numberOfResetsPerLap={numberOfResetsPerLap}
      raceTimeInMin={raceTimeInMin}
      onChange={UpdateConfig}
      resetOptions={resetOptions}
      raceTimeOptions={raceTimeOptions}
    />
  );

  // Select race customizations footer
  useEffect(() => {
    setRaceCustomizationsFooter(
      <DefaultRacingFooter
        numberOfResetsPerLap={numberOfResetsPerLap}
        raceTimeInMin={raceTimeInMin}
        onChange={UpdateConfig}
        resetOptions={resetOptions}
        raceTimeOptions={raceTimeOptions}
      />
    );
    // }
  }, [numberOfResetsPerLap, raceTimeInMin]);

  // JSX
  return (
    <Container
      header={<Header variant="h2">Race settings</Header>}
      footer={<RaceCustomizationsFooter>{raceCustomizationsFooter}</RaceCustomizationsFooter>}
    >
      <SpaceBetween size="xl">
        <FormField
          label={t('events.tracks.choose')}
          description={t('events.tracks.choose-description')}
        >
          <Select
            selectedOption={GetTrackOptionFromId(trackType)}
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
            selectedOption={GetRankingOptionFromId(rankingMethod)}
            onChange={({ detail }) => UpdateConfig({ rankingMethod: detail.selectedOption.value })}
            options={raceRankingOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
