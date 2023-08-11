import { useCollection } from '@cloudscape-design/collection-hooks';
import { Header, PropertyFilter, SpaceBetween, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePagination,
  TablePreferences,
} from '../tableConfig';

import { useTranslation } from 'react-i18next';
import { useCarsContext } from '../../store/storeProvider';
import { ColumnsConfig, FilteringProperties, VisibleContentOptions } from './carTableConfig';

const Actions = ({ children, t, setOnline, setIsLoading, edit = false }) => {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {children}
    </SpaceBetween>
  );
};

export const CarsTable = ({ selectedCarsInTable = [], setSelectedCarsInTable, fleetName = '' }) => {
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

  useEffect(() => {
    return () => {
      // Unmounting
    };
  }, [fleetName]);

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['carName', 'fleetName', 'carIp'],
  });

  const columnDefinitions = ColumnsConfig();
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  let defaultQuery = { tokens: [], operation: 'and' };
  if (fleetName.length > 0) {
    defaultQuery = {
      tokens: [{ propertyKey: 'fleetName', value: fleetName, operator: '=' }],
      operation: 'and',
    };
  }

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(cars, {
    propertyFiltering: {
      filteringProperties,
      defaultQuery: defaultQuery,
      empty: <TableEmptyState resourceName="Car" />,
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: 'and' });
          }}
          label={t('common.no-matches')}
          description={t('common.we-cant-find-a-match')}
          buttonLabel={t('button.clear-filters')}
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: { defaultState: { sortingColumn: columnDefinitions[1] } },
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
      columnDefinitions={columnDefinitions}
      items={items}
      pagination={<TablePagination paginationProps={paginationProps} />}
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings('cars')}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('cars.filter-cars')}
          expandToViewport={true}
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
