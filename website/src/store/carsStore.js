import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_CARS: (curState, carsToAdd) => {
      console.debug('ADD_CARS DISPATCH FUNCTION');
      const updatedCars = { ...curState.cars };
      carsToAdd.forEach((carToAdd) => {
        const index = updatedCars.cars.findIndex((car) => car.instanceId === carToAdd.instanceId);
        if (index > -1) {
          updatedCars.cars.splice(index, 0, carToAdd);
        } else {
          updatedCars.cars.push(carToAdd);
        }
      });
      updatedCars.cars.sort().reverse();
      return { cars: updatedCars };
    },
    DELETE_CAR: (curState, car) => {
      console.debug('DELETE_CAR DISPATCH FUNCTION');
      const updatedCars = { ...curState.cars };
      return { cars: updatedCars.cars.filter((c) => c.instanceId !== car.instanceId) };
    },
    CARS_IS_LOADING: (curState, isLoading) => {
      console.debug('CARS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedCars = { ...curState.cars };
      updatedCars.isLoading = isLoading;
      return { cars: updatedCars };
    },
  };

  initStore(actions, { cars: { cars: [], isLoading: true } });
};

export default configureStore;
