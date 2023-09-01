import { SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { TableHeader } from '../tableConfig';

import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/store';
import { PageTable } from '../pageTable';
import { ColumnConfiguration, FilteringProperties } from './carTableConfig';
const Actions = ({ children, t, setOnline, setIsLoading }) => {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {children}
    </SpaceBetween>
  );
};

export const CarsTable = ({
  selectedCarsInTable = [],
  setSelectedCarsInTable,
  editFleetName = '',
}) => {
  const { t } = useTranslation();
  const [selectedCarsBtnDisabled, setSelectedCarsBtnDisabled] = useState(true);
  const [online, setOnline] = useState('Online');

  const [state] = useStore();
  const cars = state.cars.cars;
  const isLoading = state.cars.isLoading;

  const [query, setQuery] = useState({ tokens: [], operation: 'and' });

  useEffect(() => {
    // getCars();
    return () => {
      // Unmounting
    };
  }, [online]);

  useEffect(() => {
    if (editFleetName.length > 0) {
      setQuery({
        tokens: [{ propertyKey: 'fleetName', value: editFleetName, operator: '=' }],
        operation: 'and',
      });
    }
    return () => {
      // Unmounting
    };
  }, [editFleetName]);

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
          actions={<Actions t={t} setOnline={setOnline} />}
        />
      }
      itemsIsLoading={isLoading}
      loadingText={t('cars.loading')}
      localStorageKey="cars-table-preferences"
      trackBy="instanceId"
      filteringProperties={filteringProperties}
      filteringI18nStringsName={'cars'}
    />
  );
};
