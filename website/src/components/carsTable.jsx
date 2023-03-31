// import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Header, SpaceBetween, Table, TextFilter } from '@cloudscape-design/components';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  CarColumnsConfig,
  CarVisibleContentOptions,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePagination,
  TablePreferences,
} from './tableConfig';

import { useTranslation } from 'react-i18next';
import { useCarsContext } from '../store/storeProvider';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
var utc = require('dayjs/plugin/utc');

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const Actions = ({ children, t, setOnline, setIsLoading, edit = false }) => {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {/* <ButtonDropdown
        items={[
          { text: t('cars.online'), id: 'Online', disabled: false },
          { text: t('cars.offline'), id: 'Offline', disabled: false },
        ]}
        onItemClick={({ detail }) => {
          setOnline(detail.id);
          setIsLoading(true);
        }}
      > */}
      {children}
      {/* </ButtonDropdown> */}
      {/* {edit ? (
        <EditCarsModal
          disabled={selectedCarsBtnDisabled}
          setRefresh={setRefresh}
          selectedItems={selectedCarsInTable}
          online={onlineBool}
          variant="primary"
        />
      ) : undefined} */}
    </SpaceBetween>
  );
};

export const CarTable = ({ selectedCarsInTable = [], setSelectedCarsInTable }) => {
  const { t } = useTranslation();
  const [selectedCarsBtnDisabled, setSelectedCarsBtnDisabled] = useState(true);
  const [online, setOnline] = useState('Online');
  const [onlineBool, setOnlineBool] = useState(true);

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

  const carColumnsConfig = CarColumnsConfig();

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
      sorting: { defaultState: { sortingColumn: carColumnsConfig[1] } },
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
          actions={
            <Actions t={t} setOnline={setOnline} />
            //   {online}
            // </Actions>
          }
        >
          {t('cars.header')}
        </Header>
      }
      columnDefinitions={carColumnsConfig}
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
          contentOptions={CarVisibleContentOptions()}
          preferences={preferences}
          setPreferences={setPreferences}
        />
      }
    />
  );
};
