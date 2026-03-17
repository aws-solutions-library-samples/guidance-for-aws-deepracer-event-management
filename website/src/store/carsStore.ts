import { initStore } from './store';
import { GlobalState, CarsState } from './storeTypes';
import { Car } from '../types/domain';

const configureStore = (): void => {
  const actions = {
    ADD_CARS: (curState: GlobalState, carsToAdd: Car[]): Partial<GlobalState> => {
      console.debug('ADD_CARS DISPATCH FUNCTION', carsToAdd);
      const currentCars = curState.cars?.cars || [];
      const updatedCars: CarsState = { 
        ...(curState.cars || { cars: [], isLoading: false, refresh: false, offlineCars: false }),
        cars: [...currentCars]
      };
      
      carsToAdd.forEach((carToAdd) => {
        const index = updatedCars.cars.findIndex((c) => c.InstanceId === carToAdd.InstanceId);
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
    DELETE_CAR: (curState: GlobalState, instanceId: string): Partial<GlobalState> => {
      console.debug('DELETE_CAR DISPATCH FUNCTION', instanceId);
      const currentCars = curState.cars?.cars || [];
      const updatedCars: CarsState = {
        ...(curState.cars || { cars: [], isLoading: false, refresh: false, offlineCars: false }),
        cars: currentCars.filter((c) => c.InstanceId !== instanceId)
      };
      return { cars: updatedCars };
    },
    CARS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('CARS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedCars: CarsState = { 
        ...(curState.cars || { cars: [], isLoading: false, refresh: false, offlineCars: false }),
        isLoading
      };
      return { cars: updatedCars };
    },
    REFRESH_CARS: (curState: GlobalState, offlineCars: boolean): Partial<GlobalState> => {
      console.debug('REFRESH_CARS DISPATCH FUNCTION', offlineCars);
      const updatedCars: CarsState = { 
        ...(curState.cars || { cars: [], isLoading: false, refresh: false, offlineCars: false }),
        refresh: true,
        offlineCars
      };
      return { cars: updatedCars };
    },
  };

  initStore(actions, { cars: { cars: [], isLoading: true, refresh: false, offlineCars: false } });
};

export default configureStore;

// deep merge two objects
const mergeDeep = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target };
  
  if (typeof source === 'object' && source !== null) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = mergeDeep(result[key] || {} as any, value);
        } else {
          result[key] = value as any;
        }
      }
    }
  }
  return result;
};
