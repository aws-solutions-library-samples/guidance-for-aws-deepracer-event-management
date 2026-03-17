import { initStore } from './store';
import { GlobalState, FleetsState } from './storeTypes';
import { Fleet } from '../types/domain';

const configureStore = (): void => {
  const actions = {
    ADD_FLEETS: (curState: GlobalState, fleets: Fleet[]): Partial<GlobalState> => {
      console.debug('ADD_FLEETS DISPATCH FUNCTION');
      const updatedFleets: FleetsState = { ...(curState.fleets || { fleets: [], isLoading: false }) };
      updatedFleets.fleets = fleets;
      return { fleets: updatedFleets };
    },
    UPDATE_FLEET: (curState: GlobalState, fleet: Fleet): Partial<GlobalState> => {
      console.debug('UPDATE_FLEET DISPATCH FUNCTION');
      const currentFleets = curState.fleets?.fleets || [];
      const updatedFleets: FleetsState = { ...(curState.fleets || { fleets: [], isLoading: false }) };
      const fleetIndex = currentFleets.findIndex((r) => r.fleetId === fleet.fleetId);
      if (fleetIndex === -1) {
        updatedFleets.fleets.push(fleet);
      } else {
        updatedFleets.fleets[fleetIndex] = fleet;
      }
      return { fleets: updatedFleets };
    },
    DELETE_FLEETS: (curState: GlobalState, fleetIdsToDelete: string[]): Partial<GlobalState> => {
      console.debug('DELETE_FLEET DISPATCH FUNCTION');
      const currentFleets = curState.fleets?.fleets || [];
      const updatedFleets: FleetsState = {
        ...(curState.fleets || { fleets: [], isLoading: false }),
        fleets: currentFleets.filter((fleet) => !fleetIdsToDelete.includes(fleet.fleetId))
      };
      return { fleets: updatedFleets };
    },
    FLEETS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('FLEETS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedFleets: FleetsState = { ...(curState.fleets || { fleets: [], isLoading: false }) };
      updatedFleets.isLoading = isLoading;
      return { fleets: updatedFleets };
    },
  };

  initStore(actions, { fleets: { fleets: [], isLoading: true } });
};

export default configureStore;
