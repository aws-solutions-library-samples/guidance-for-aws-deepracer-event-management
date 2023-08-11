import React, { useEffect, useState } from 'react';
import { CarsTable } from '../../components/cars-table/carsTable';

export const CarsPanel = ({ carIds, onChange, fleetName }) => {
  const [selectedCars, setSelectedCars] = useState([]);
  const UpdateConfig = (attr) => {
    if (attr) {
      const carIds = attr.map((car) => car.InstanceId);
      onChange({ carIds: carIds });
    } else {
      onChange({ carIds: [] });
    }
  };

  useEffect(() => {
    if (carIds !== null) {
      const cars = carIds.map((id) => {
        return { InstanceId: id };
      });
      setSelectedCars(cars);
    }
  }, [carIds]);

  return (
    <CarsTable
      selectedCarsInTable={selectedCars}
      setSelectedCarsInTable={UpdateConfig}
      fleetName={fleetName}
    />
  );
};
