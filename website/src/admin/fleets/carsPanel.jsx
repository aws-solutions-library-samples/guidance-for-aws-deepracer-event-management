import React, { useEffect, useState } from 'react';
import { CarTable } from '../../components/carsTable';

export const CarsPanel = ({ carIds, onChange }) => {
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

  return <CarTable selectedCarsInTable={selectedCars} setSelectedCarsInTable={UpdateConfig} />;
};
