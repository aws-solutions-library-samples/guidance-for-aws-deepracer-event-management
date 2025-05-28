import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_CARS: (curState, carsToAdd) => {
      console.debug('ADD_CARS DISPATCH FUNCTION', carsToAdd);
      const updatedCars = { ...curState.cars };
      carsToAdd.forEach((carToAdd) => {
        const index = curState.cars.cars.findIndex((c) => c.InstanceId === carToAdd.InstanceId);
        if (index === -1) {
          console.debug('ADD CAR', carToAdd);
          updatedCars.cars.push(carToAdd);
        } else {
          const mergedCar = mergeDeep(updatedCars.cars[index], carToAdd);
          console.debug('MERGED CAR', mergedCar);
          updatedCars.cars[index] = mergedCar;
        }
        updatedCars.refresh = false;
      });
      return { cars: { ...updatedCars, cars: [...updatedCars.cars] } };
    },
    DELETE_CAR: (curState, car) => {
      console.debug('DELETE_CAR DISPATCH FUNCTION', car);
      const updatedCars = { ...curState.cars };
      updatedCars.cars = updatedCars.cars.filter((c) => c.InstanceId !== car);
      return { cars: { ...updatedCars, cars: [...updatedCars.cars] } };
    },
    CARS_IS_LOADING: (curState, isLoading) => {
      console.debug('CARS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedCars = { ...curState.cars };
      updatedCars.isLoading = isLoading;
      return { cars: { ...updatedCars } };
    },
    REFRESH_CARS: (curState, offlineCars) => {
      console.debug('REFRESH_CARS DISPATCH FUNCTION', offlineCars);
      const updatedCars = { ...curState.cars };
      updatedCars.refresh = true;
      updatedCars.offlineCars = offlineCars;
      return { cars: { ...updatedCars } };
    },
  };

  initStore(actions, { cars: { cars: [], isLoading: true, refresh: false, offlineCars: false } });
};

export default configureStore;

// deep merge two objects
const mergeDeep = (target, source) => {
  if (typeof source === 'object') {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (typeof value === 'object') {
          target[key] = mergeDeep(target[key], value);
        } else {
          target[key] = value;
        }
      }
    }
  }
  return target;
};
