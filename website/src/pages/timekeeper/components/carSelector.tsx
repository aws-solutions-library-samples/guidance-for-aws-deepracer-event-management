import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button } from '@cloudscape-design/components';

import { PageTable } from '../../../components/pageTable';
import { EmptyState, TableHeader } from '../../../components/tableConfig';

import {
  ColumnConfiguration,
  FilteringProperties,
} from '../../../components/devices-table/deviceTableConfig';
import { useStore } from '../../../store/store';

interface QueryToken {
  propertyKey?: string;
  value?: string;
  operator?: string;
}

interface Query {
  tokens: QueryToken[];
  operation: 'and' | 'or';
}

interface Car {
  InstanceId: string;
  PingStatus: string;
  Type: string;
  key?: string;
  modelId?: string;
  uploadedDateTime?: string;
  status?: string;
}

interface CarSelectorProps {
  query?: Query;
  selectedCars: Car[];
  setSelectedCars: (cars: Car[]) => void;
}

export const CarSelector: React.FC<CarSelectorProps> = ({
  query = { tokens: [], operation: 'and' },
  selectedCars,
  setSelectedCars,
}) => {
  const { t } = useTranslation();

  const [state] = useStore() as any; // TODO: Type store properly
  const cars: Car[] = state.cars.cars.filter(
    (car: Car) => car.PingStatus === 'Online' && car.Type === 'deepracer'
  );
  const enrichedCars: Car[] = cars.map((car) => {
    car['key'] = car['InstanceId'];
    console.log('car:', car);
    return car;
  });

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(enrichedCars, {
      filtering: {
        empty: (
          <EmptyState
            title={t('carmodelupload.no-cars')}
            subtitle={t('carmodelupload.no-cars-online')}
            action={<div />}
          />
        ),
        noMatch: (
          <EmptyState
            title={t('common.no-matches')}
            subtitle={t('common.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>
                {t('carmodelupload.clear-filter')}
              </Button>
            }
          />
        ),
      },
      sorting: { defaultState: { sortingColumn: columnConfiguration.columnDefinitions[1] } },
    });

  let tabeleHeaderContent = (
    <TableHeader
      nrSelectedItems={selectedCars.length}
      nrTotalItems={items.length}
      header={t('devices.cars')}
    />
  );

  return (
    <PageTable
      selectedItems={selectedCars}
      setSelectedItems={setSelectedCars}
      tableItems={[...items] as any[]}
      selectionType="single"
      columnConfiguration={columnConfiguration as any}
      trackBy="modelId"
      sortingColumn={{ sortingField: 'uploadedDateTime' } as any}
      header={tabeleHeaderContent}
      itemsIsLoading={false}
      //isItemDisabled={(item) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
      loadingText={t('cars.loading-models')}
      localStorageKey="cars-table-preferences"
      filteringProperties={filteringProperties as any}
      filteringI18nStringsName="cars"
      query={query as any}
    />
  );
};
