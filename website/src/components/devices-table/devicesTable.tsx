import React, { useEffect, useState } from 'react';
import { PropertyFilterProps } from '@cloudscape-design/components';
import { TableHeader } from '../tableConfig';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/store';
import { PageTable } from '../pageTable';
import { ColumnConfiguration, FilteringProperties } from './deviceTableConfig';
import { Car } from '../../types/domain';

/**
 * Query structure for property filtering
 */
interface FilterQuery {
  tokens: PropertyFilterProps.Token[];
  operation: 'and' | 'or';
}

/**
 * Props for DevicesTable component
 */
interface DevicesTableProps {
  selectedDevicesInTable?: Car[];
  initialSelectedDevices?: Car[];
  setSelectedDevicesInTable?: (devices: Car[]) => void;
  fleetQuery?: string;
  fleetName?: string;
}

export const DevicesTable: React.FC<DevicesTableProps> = ({
  selectedDevicesInTable = [],
  initialSelectedDevices = [],
  setSelectedDevicesInTable,
  fleetQuery = '',
  fleetName = '',
}) => {
  const { t } = useTranslation();

  const [state] = useStore();
  const cars = state.cars?.cars || [];
  const isLoading = state.cars?.isLoading || false;

  const [query, setQuery] = useState<FilterQuery>({ tokens: [], operation: 'and' });
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
      setSelectedItems={setSelectedDevicesInTable as any}
      tableItems={cars}
      selectionType="multi"
      columnConfiguration={columnConfiguration as any}
      header={
        <TableHeader
          nrSelectedItems={selectedDevicesInTable.length}
          nrTotalItems={cars.length}
          header={t('devices.header')}
        />
      }
      isItemDisabled={(item: Car) =>
        initialSelectedDevices.some((device) => device.InstanceId === item.InstanceId)
      }
      itemsIsLoading={isLoading}
      loadingText={t('devices.loading')}
      localStorageKey="devices-table-preferences"
      trackBy="InstanceId"
      filteringProperties={filteringProperties as any}
      filteringI18nStringsName="devices"
      query={query as any}
    />
  );
};
