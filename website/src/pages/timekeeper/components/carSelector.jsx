import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button
} from '@cloudscape-design/components';

import { PageTable } from '../../../components/pageTable';
import {
  EmptyState,
  TableHeader
} from '../../../components/tableConfig';


import { ColumnConfiguration, FilteringProperties } from '../../../components/devices-table/deviceTableConfig';
import { useStore } from '../../../store/store';


export const CarSelector = ({ 
  query = { tokens: [], operation: 'and' },
  selectedCars,
  setSelectedCars
 }) => {
  const { t } = useTranslation();

  const [state] = useStore();
  const cars = state.cars.cars.filter((car) => car.PingStatus === 'Online');
  const enrichedCars = cars.map(car => {
    car['key'] = car['InstanceId'];
    console.log('car:', car);
    return car
 })

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(enrichedCars, {
      filtering: {
        empty: (
          <EmptyState
            title={t('carmodelupload.no-cars')}
            subtitle={t('carmodelupload.no-cars-online')}
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
    tableItems={items}
    selectionType="single"
    columnConfiguration={columnConfiguration}
    trackBy="modelId"
    sortingColumn="uploadedDateTime"
    header={tabeleHeaderContent}
    itemsIsLoading={false}
    //isItemDisabled={(item) => !['AVAILABLE', 'OPTIMIZED'].includes(item.status)}
    loadingText={t('models.loading-models')}
    localStorageKey="models-table-preferences"
    filteringProperties={filteringProperties}
    filteringI18nStringsName="models"
    query={query}
  />
  );
};
