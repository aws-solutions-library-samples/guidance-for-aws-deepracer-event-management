import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_RACES: (curState, racesToAdd) => {
      const updatedRaces = { ...curState.races };
      racesToAdd.forEach((raceToAdd) => {
        const raceIndex = curState.races.races.findIndex((r) => r.raceId === raceToAdd.raceId);
        if (raceIndex === -1) {
          updatedRaces.races.push(raceToAdd);
        } else {
          updatedRaces.races[raceIndex] = raceToAdd;
        }
      });
      return { races: updatedRaces };
    },
    UPDATE_RACE: (curState, race) => {
      console.debug('UPDATE_RACE DISPATCH FUNCTION');
      const updatedRaces = { ...curState.races };
      const raceIndex = curState.races.races.findIndex((r) => r.raceId === race.raceId);
      if (raceIndex === -1) {
        updatedRaces.races.push(race);
      } else {
        updatedRaces.races[raceIndex] = race;
      }
      return { races: updatedRaces };
    },
    DELETE_RACES: (curState, raceIdsToDelete) => {
      console.debug('DELETE_RACE DISPATCH FUNCTION', raceIdsToDelete);
      const updatedRaces = { ...curState.races };
      updatedRaces.races = updatedRaces.races.filter((race) => {
        return !raceIdsToDelete.find((raceIdToDelete) => {
          return raceIdToDelete === race.raceId;
        });
      });
      return { races: updatedRaces };
    },
    RACES_IS_LOADING: (curState, isLoading) => {
      console.debug('RACES_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedRaces = { ...curState.races };
      updatedRaces.isLoading = isLoading;
      return { races: updatedRaces };
    },
  };

  initStore(actions, { races: { races: [], isLoading: true } });
};

export default configureStore;
