import React, { useEffect, useState } from 'react';
import { TableHeader } from '../tableConfig';

import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/store';
import { PageTable } from '../pageTable';
import { ColumnConfiguration, FilteringProperties } from './deviceTableConfig';

export const DevicesTable = ({
  selectedDevicesInTable = [],
  initialSelectedDevices = [],
  setSelectedDevicesInTable,
  fleetQuery = '',
  fleetName = '',
}) => {
  const { t } = useTranslation();

  const [state] = useStore();
  const cars = state.cars.cars;
  const isLoading = state.cars.isLoading;

  const [query, setQuery] = useState({ tokens: [], operation: 'and' });
  const [columnConfiguration] = useState(() =>
    ColumnConfiguration(['carName', 'fleetName', 'carIp'])
  );
  const [filteringProperties] = useState(() => FilteringProperties());

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

  return (
    <PageTable
      selectedItems={selectedDevicesInTable}
      setSelectedItems={setSelectedDevicesInTable}
      tableItems={cars}
      selectionType="multi"
      columnConfiguration={columnConfiguration}
      header={
        <TableHeader
          nrSelectedItems={selectedDevicesInTable.length}
          nrTotalItems={cars.length}
          header={t('devices.header')}
        />
      }
      isItemDisabled={(item) =>
        initialSelectedDevices.some((device) => device.InstanceId === item.InstanceId)
      }
      itemsIsLoading={isLoading}
      loadingText={t('devices.loading')}
      localStorageKey="devices-table-preferences"
      trackBy="InstanceId"
      filteringProperties={filteringProperties}
      filteringI18nStringsName={'devices'}
      query={query}
    />
  );
};
