import i18next from '../../i18n';

// LAP RESET OPTIONS METHODS
export const ResetConfig = () => {
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

export const GetRaceResetsNameFromId = (id) => {
  if (id) {
    const resetConfig = ResetConfig();
    const item = resetConfig.find((item) => item.value.toString() === id.toString());
    return item.label;
  }
  return '';
};

export const GetResetOptionFromId = (id) => {
  if (id) {
    const resetConfig = ResetConfig();
    const test = resetConfig.find((option) => option.value.toString() === id.toString());
    return test;
  }
};

// RACE TIME OPTIONS METHODS
export const RaceTimeConfig = () => {
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

export const GetRaceTimeOptionFromId = (id) => {
  if (id) {
    const raceTimeOptions = RaceTimeConfig();
    return raceTimeOptions.find((option) => option.value.toString() === id.toString());
  }
};

// LAPS OPTIONS METHODS
export const LapConfig = () => {
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

export const GetLapsOptionFromId = (id) => {
  if (id) {
    const lapsToFinishOptions = LapConfig();
    return lapsToFinishOptions.find((option) => option.value.toString() === id.toString());
  }
};

// RACE TYPE OPTIONS METHODS
export const RaceTypeConfig = () => {
  return [
    { label: i18next.t('events.race.ranking.best-lap-time'), value: 'best-lap-time' },
    //   { label: i18next.t('events.race.ranking.finish-x-laps'), value: 'finish-x-laps' }, // TODO: not yet implemented in Time keeper
  ];
};

export const GetRankingOptionFromId = (id) => {
  if (id) {
    const raceRankingOptions = RaceTypeConfig();
    return raceRankingOptions.find((option) => option.value === id);
  }
};

export const GetRaceTypeNameFromId = (id) => {
  if (id) {
    const raceTypeConfig = RaceTypeConfig();
    const item = raceTypeConfig.find((item) => item.value.toString() === id.toString());
    if (item && item.label) {
      return item.label;
    }
    return undefined;
  }
  return undefined;
};
