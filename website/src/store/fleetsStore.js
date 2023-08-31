import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_FLEETS: (curState, fleets) => {
      console.debug('ADD_FLEETS DISPATCH FUNCTION');
      const updatedFleets = { ...curState.fleets };
      updatedFleets.fleets = fleets;
      return { fleets: updatedFleets };
    },
    UPDATE_FLEET: (curState, fleet) => {
      console.debug('UPDATE_FLEET DISPATCH FUNCTION');
      const updatedFleets = { ...curState.fleets };
      const fleetIndex = curState.fleets.fleets.findIndex((r) => r.fleetId === fleet.fleetId);
      if (fleetIndex === -1) {
        updatedFleets.fleets.push(fleet);
      } else {
        updatedFleets.fleets[fleetIndex] = fleet;
      }
      return { fleets: updatedFleets };
    },
    DELETE_FLEETS: (curState, fleetIdsToDelete) => {
      console.debug('DELETE_FLEET DISPATCH FUNCTION');
      const updatedFleets = { ...curState.fleets };
      updatedFleets.fleets = updatedFleets.fleets.filter((fleet) => {
        return !fleetIdsToDelete.find((fleetIdToDelete) => {
          return fleetIdToDelete === fleet.fleetId;
        });
      });
      return { fleets: updatedFleets };
    },
    FLEETS_IS_LOADING: (curState, isLoading) => {
      console.debug('FLEETS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedFleets = { ...curState.fleets };
      updatedFleets.isLoading = isLoading;
      return { fleets: updatedFleets };
    },
  };

  initStore(actions, { fleets: { fleets: [], isLoading: true } });
};

export default configureStore;
