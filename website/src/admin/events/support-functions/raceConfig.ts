import i18next from '../../../i18n';

/**
 * Option interface for configuration dropdowns
 */
export interface ConfigOption {
  label: string;
  value: string;
}

/**
 * Race type enumeration
 */
export const RaceTypeEnum = {
  BEST_AVERAGE_LAP_TIME_X_LAP: 'BEST_AVERAGE_LAP_TIME_X_LAP',
  BEST_LAP_TIME: 'BEST_LAP_TIME',
} as const;

export type RaceType = typeof RaceTypeEnum[keyof typeof RaceTypeEnum];

// LAP RESET OPTIONS METHODS
export const ResetConfig = (): ConfigOption[] => {
  return [
    { label: i18next.t('events.race.unlimited'), value: '9999' },
    { label: '10', value: '10' },
    { label: '9', value: '9' },
    { label: '8', value: '8' },
    { label: '7', value: '7' },
    { label: '6', value: '6' },
    { label: '5', value: '5' },
    { label: '4', value: '4' },
    { label: '3', value: '3' },
    { label: '2', value: '2' },
    { label: '1', value: '1' },
    { label: '0', value: '0' },
  ];
};

export const GetRaceResetsNameFromId = (id: string | number | null | undefined): string => {
  if (id == null) return '';

  const resetConfig = ResetConfig();
  const item = resetConfig.find((item) => item.value.toString() === id.toString());
  return item?.label || '';
};

export const GetResetOptionFromId = (id: string | number | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const resetConfig = ResetConfig();
  return resetConfig.find((option) => option.value.toString() === id.toString());
};

// RACE TIME OPTIONS METHODS
export const RaceTimeConfig = (): ConfigOption[] => {
  return [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '10', value: '10' },
  ];
};

export const GetRaceTimeOptionFromId = (id: string | number | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const raceTimeOptions = RaceTimeConfig();
  return raceTimeOptions.find((option) => option.value.toString() === id.toString());
};

// Allowed no races per racer during an event
export const MaxRunsPerRacerConfig = (): ConfigOption[] => {
  return [
    { label: i18next.t('events.race.unlimited'), value: '9999' },
    { label: '5', value: '5' },
    { label: '4', value: '4' },
    { label: '3', value: '3' },
    { label: '2', value: '2' },
    { label: '1', value: '1' },
  ];
};

export const GetMaxRunsPerRacerFromId = (id: string | number | null | undefined): string => {
  if (id == null) return '';

  const allowedRacesPerRacerConfig = MaxRunsPerRacerConfig();
  const item = allowedRacesPerRacerConfig.find((item) => item.value.toString() === id.toString());
  return item?.label || '';
};

export const GetMaxRunsPerRacerOptionFromId = (id: string | number | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const allowedRacesPerRacerConfig = MaxRunsPerRacerConfig();
  return allowedRacesPerRacerConfig.find((item) => item.value.toString() === id.toString());
};

// LAPS OPTIONS METHODS
export const LapConfig = (): ConfigOption[] => {
  return [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '10', value: '10' },
  ];
};

export const GetLapsOptionFromId = (id: string | number | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const lapsToFinishOptions = LapConfig();
  return lapsToFinishOptions.find((option) => option.value.toString() === id.toString());
};

// TRACK OPTIONS METHODS
export const TrackTypeConfig = (): ConfigOption[] => {
  return [
    { label: i18next.t('events.tracks.reinvent-2018'), value: 'REINVENT_2018' },
    { label: i18next.t('events.tracks.reinvent-2019'), value: 'REINVENT_2019' },
    { label: i18next.t('events.tracks.reinvent-2022'), value: 'REINVENT_2022' },
    { label: i18next.t('events.tracks.reinvent-2023'), value: 'REINVENT_2023' },
    { label: i18next.t('events.tracks.forever-raceway'), value: 'FOREVER_RACEWAY' },
    { label: i18next.t('events.tracks.atoz-speedway'), value: 'ATOZ_SPEEDWAY' },
    { label: i18next.t('events.tracks.summit-2022'), value: 'SUMMIT_SPEEDWAY' },
    { label: i18next.t('events.tracks.other'), value: 'OTHER' },
  ];
};

export const GetTrackOptionFromId = (id: string | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const trackOptions = TrackTypeConfig();
  return trackOptions.find((option) => option.value === id);
};

export const GetTrackTypeNameFromId = (id: string | null | undefined): string | undefined => {
  if (id == null) return undefined;

  const trackOptions = TrackTypeConfig();
  const item = trackOptions.find((item) => item.value.toString() === id.toString());
  if (item?.label) {
    return item.label;
  }
  return undefined;
};

// RACE TYPE OPTIONS METHODS
export const RaceTypeConfig = (): ConfigOption[] => {
  return [
    { label: i18next.t('events.race.ranking.best-lap-time'), value: RaceTypeEnum.BEST_LAP_TIME },
    //   { label: i18next.t('events.race.ranking.finish-x-laps'), value: 'FINISH_X_LAPS' },
    {
      label: i18next.t('events.race.ranking.best-average-lap-time-x-lap'),
      value: RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP,
    },
  ];
};

export const GetRankingOptionFromId = (id: string | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const raceRankingOptions = RaceTypeConfig();
  return raceRankingOptions.find((option) => option.value === id);
};

export const GetRankingNameFromId = (id: string | null | undefined): string | undefined => {
  if (id == null) return undefined;

  const raceRankingOptions = RaceTypeConfig();
  const option = raceRankingOptions.find((option) => option.value === id);
  return option?.label;
};

export const GetRaceTypeNameFromId = (id: string | null | undefined, averageLapsWindowSize?: string): string | undefined => {
  if (id == null) return undefined;

  const raceTypeConfig = RaceTypeConfig();
  const item = raceTypeConfig.find((item) => item.value.toString() === id.toString());
  if (item?.label) {
    let returnValue = item.label;
    if (averageLapsWindowSize) {
      returnValue = returnValue.replace('X', averageLapsWindowSize);
    }
    return returnValue;
  }
  return undefined;
};

export const AverageLapWindowConfig = (): ConfigOption[] => {
  return [
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
  ];
};

export const GetAverageLapWindowFromId = (id: string | number | null | undefined): ConfigOption | undefined => {
  if (id == null) return undefined;

  const averageLapsWindowOptions = AverageLapWindowConfig();
  return averageLapsWindowOptions.find((option) => option.value.toString() === id.toString());
};
