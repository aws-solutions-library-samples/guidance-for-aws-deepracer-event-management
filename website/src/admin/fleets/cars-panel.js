import React, { useEffect, useState } from 'react';
import { CarTable } from '../../components/CarsTable';

export const CarsPanel = ({ carIds, onChange }) => {
  const [selectedCars, setSelectedCars] = useState([]);
  const UpdateConfig = (attr) => {
    console.log(attr);
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
