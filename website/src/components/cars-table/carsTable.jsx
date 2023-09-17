import React, { useEffect, useState } from 'react';
import { TableHeader } from '../tableConfig';

import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/store';
import { PageTable } from '../pageTable';
import { ColumnConfiguration, FilteringProperties } from './carTableConfig';

export const CarsTable = ({
  selectedCarsInTable = [],
  setSelectedCarsInTable,
  fleetQuery = '',
  fleetName = '',
}) => {
  const { t } = useTranslation();

  const [state] = useStore();
  const cars = state.cars.cars;
  const isLoading = state.cars.isLoading;

  const [query, setQuery] = useState({ tokens: [], operation: 'and' });

  useEffect(() => {
    if (fleetQuery.length > 0) {
      setQuery({
        tokens: [{ propertyKey: 'fleetName', value: fleetQuery, operator: '=' }],
        operation: 'and',
      });
    }
    return () => {
      // Unmounting
    };
  }, [fleetQuery]);

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  return (
    <PageTable
      selectedItems={selectedCarsInTable}
      setSelectedItems={setSelectedCarsInTable}
      tableItems={cars}
      selectionType="multi"
      columnConfiguration={columnConfiguration}
      header={
        <TableHeader
          nrSelectedItems={selectedCarsInTable.length}
          nrTotalItems={cars.length}
          header={t('cars.header')}
        />
      }
      itemsIsLoading={isLoading}
      loadingText={t('cars.loading')}
      localStorageKey="cars-table-preferences"
      trackBy="instanceId"
      filteringProperties={filteringProperties}
      filteringI18nStringsName={'cars'}
      query={query}
    />
  );
};
