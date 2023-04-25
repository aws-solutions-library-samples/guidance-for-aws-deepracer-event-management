import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Header, SpaceBetween, Table, TextFilter } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePagination,
  TablePreferences,
} from '../tableConfig';

import { useTranslation } from 'react-i18next';
import { useCarsContext } from '../../store/storeProvider';
import { ColumnsConfig, VisibleContentOptions } from './carTableConfig';

const Actions = ({ children, t, setOnline, setIsLoading, edit = false }) => {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {children}
    </SpaceBetween>
  );
};

export const CarsTable = ({ selectedCarsInTable = [], setSelectedCarsInTable }) => {
  const { t } = useTranslation();
  const [selectedCarsBtnDisabled, setSelectedCarsBtnDisabled] = useState(true);
  const [online, setOnline] = useState('Online');

  const [cars, isLoading] = useCarsContext();

  useEffect(() => {
    // getCars();
    return () => {
      // Unmounting
    };
  }, [online]);

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['carName', 'fleetName', 'carIp'],
  });

  const columnsConfig = ColumnsConfig();
  const visibleContentOptions = VisibleContentOptions();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(cars, {
      filtering: {
        empty: <EmptyState title={t('cars.no-cars')} subtitle={t('cars.no-cars-message')} />,
        noMatch: (
          <EmptyState
            title={t('models.no-matches')}
            subtitle={t('models.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('table.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnsConfig[1] } },
      selection: {},
    });

  return (
    <Table
      {...collectionProps}
      header={
        <Header
          counter={
            selectedCarsInTable.length
              ? `(${selectedCarsInTable.length}/${cars.length})`
              : `(${cars.length})`
          }
          actions={<Actions t={t} setOnline={setOnline} />}
        >
          {t('cars.header')}
        </Header>
      }
      columnDefinitions={columnsConfig}
      items={items}
      pagination={<TablePagination paginationProps={paginationProps} />}
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('cars.filter-cars')}
        />
      }
      loading={isLoading}
      loadingText={t('cars.loading')}
      visibleColumns={preferences.visibleContent}
      selectionType="multi"
      stickyHeader="true"
      trackBy="InstanceId"
      selectedItems={selectedCarsInTable}
      onSelectionChange={({ detail: { selectedItems } }) => {
        console.log(selectedItems);
        setSelectedCarsInTable(selectedItems);
        selectedCarsInTable.length
          ? setSelectedCarsBtnDisabled(false)
          : setSelectedCarsBtnDisabled(true);
      }}
      resizableColumns
      preferences={
        <TablePreferences
          contentOptions={visibleContentOptions}
          preferences={preferences}
          setPreferences={setPreferences}
        />
      }
    />
  );
};
