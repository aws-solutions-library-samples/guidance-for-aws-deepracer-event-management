import React, { createContext } from 'react';
import { useCarsApi } from '../hooks/useCarsApi';

export const carsContext = createContext();

const CarsProvider = (props) => {
  const [cars, isLoading, errorMessage] = useCarsApi();

  return <carsContext.Provider value={[cars]}>{props.children}</carsContext.Provider>;
};

export default CarsProvider;
