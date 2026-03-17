import { initStore } from './store';
import { GlobalState, RacesState } from './storeTypes';
import { Race } from '../types/domain';

const configureStore = (): void => {
  const actions = {
    NEW_RACES: (curState: GlobalState, racesToAdd: Race[]): Partial<GlobalState> => {
      const updatedRaces: RacesState = { 
        ...(curState.races || { races: [], isLoading: false }),
        races: []
      };
      
      racesToAdd.forEach((raceToAdd) => {
        const raceIndex = updatedRaces.races.findIndex((r) => r.raceId === raceToAdd.raceId);
        if (raceIndex === -1) {
          updatedRaces.races.push(raceToAdd);
        } else {
          updatedRaces.races[raceIndex] = raceToAdd;
        }
      });
      return { races: updatedRaces };
    },
    ADD_RACES: (curState: GlobalState, racesToAdd: Race[]): Partial<GlobalState> => {
      const currentRaces = curState.races?.races || [];
      const updatedRaces: RacesState = { 
        ...(curState.races || { races: [], isLoading: false }),
        races: [...currentRaces]
      };
      
      racesToAdd.forEach((raceToAdd) => {
        const raceIndex = updatedRaces.races.findIndex((r) => r.raceId === raceToAdd.raceId);
        if (raceIndex === -1) {
          updatedRaces.races.push(raceToAdd);
        } else {
          updatedRaces.races[raceIndex] = raceToAdd;
        }
      });
      return { races: updatedRaces };
    },
    UPDATE_RACE: (curState: GlobalState, race: Race): Partial<GlobalState> => {
      console.debug('UPDATE_RACE DISPATCH FUNCTION');
      const currentRaces = curState.races?.races || [];
      const updatedRaces: RacesState = { 
        ...(curState.races || { races: [], isLoading: false }),
        races: [...currentRaces]
      };
      const raceIndex = updatedRaces.races.findIndex((r) => r.raceId === race.raceId);
      if (raceIndex === -1) {
        updatedRaces.races.push(race);
      } else {
        updatedRaces.races[raceIndex] = race;
      }
      return { races: updatedRaces };
    },
    DELETE_RACES: (curState: GlobalState, raceIdsToDelete: string[]): Partial<GlobalState> => {
      console.debug('DELETE_RACE DISPATCH FUNCTION', raceIdsToDelete);
      const currentRaces = curState.races?.races || [];
      const updatedRaces: RacesState = {
        ...(curState.races || { races: [], isLoading: false }),
        races: currentRaces.filter((race) => !raceIdsToDelete.includes(race.raceId))
      };
      return { races: updatedRaces };
    },
    RACES_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('RACES_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedRaces: RacesState = { 
        ...(curState.races || { races: [], isLoading: false }),
        isLoading
      };
      return { races: updatedRaces };
    },
  };

  initStore(actions, { races: { races: [], isLoading: true } });
};

export default configureStore;
