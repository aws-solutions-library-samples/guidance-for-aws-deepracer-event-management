// import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  ButtonDropdown,
  CollectionPreferences,
  Grid,
  Header,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

import { useTranslation } from 'react-i18next';
import { ContentHeader } from '../components/contentHeader';
import EditCarsModal from '../components/editCarsModal';
import {
  CarColumnsConfig,
  CarVisibleContentOptions,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/tableConfig';
import * as queries from '../graphql/queries';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin
var utc = require('dayjs/plugin/utc');

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const AdminCars = () => {
  const { t } = useTranslation();
  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCarsBtnDisabled, setSelectedCarsBtnDisabled] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [online, setOnline] = useState('Online');
  const [onlineBool, setOnlineBool] = useState(true);
  const [refresh, setRefresh] = useState(false);

  // Get Cars
  async function getCars() {
    var thisOnlineBool = true;
    if (online !== 'Online') {
      setOnlineBool(false);
      thisOnlineBool = false;
    } else {
      setOnlineBool(true);
    }
    const response = await API.graphql({
      query: queries.carsOnline,
      variables: { online: thisOnlineBool },
    });
    setSelectedCarsBtnDisabled(true);
    setSelectedItems([]);
    setIsLoading(false);
    setItems(response.data.carsOnline);
  }

  useEffect(() => {
    getCars();
    return () => {
      // Unmounting
    };
  }, [online]);

  useEffect(() => {
    if (refresh) {
      setIsLoading(true);
      getCars();
      setRefresh(false);
    }
    return () => {
      // Unmounting
    };
  }, [refresh]);

  const [preferences, setPreferences] = useLocalStorage('DREM-cars-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['carName', 'fleetName', 'carIp'],
  });

  const carColumnsConfig = CarColumnsConfig();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(allItems, {
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
    <>
      <ContentHeader
        header={t('cars.header')}
        description={t('cars.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('cars.breadcrumb') },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={
                selectedItems.length
                  ? `(${selectedItems.length}/${allItems.length})`
                  : `(${allItems.length})`
              }
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <ButtonDropdown
                    items={[
                      { text: t('cars.online'), id: 'Online', disabled: false },
                      { text: t('cars.offline'), id: 'Offline', disabled: false },
                    ]}
                    onItemClick={({ detail }) => {
                      setOnline(detail.id);
                      setIsLoading(true);
                    }}
                  >
                    {online}
                  </ButtonDropdown>
                  <EditCarsModal
                    disabled={selectedCarsBtnDisabled}
                    setRefresh={setRefresh}
                    selectedItems={selectedItems}
                    online={onlineBool}
                    variant="primary"
                  />
                </SpaceBetween>
              }
            >
              {t('cars.header')}
            </Header>
          }
          columnDefinitions={carColumnsConfig}
          items={items}
          pagination={
            <Pagination
              {...paginationProps}
              ariaLabels={{
                nextPageLabel: t('table.next-page'),
                previousPageLabel: t('table.previous-page'),
                pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
              }}
            />
          }
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
          selectedItems={selectedItems}
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems);
            selectedItems.length
              ? setSelectedCarsBtnDisabled(false)
              : setSelectedCarsBtnDisabled(true);
          }}
          resizableColumns
          preferences={
            <CollectionPreferences
              title={t('table.preferences')}
              confirmLabel={t('button.confirm')}
              cancelLabel={t('button.cancel')}
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference(t('cars.page-size-label'))}
              visibleContentPreference={{
                title: t('table.select-visible-colunms'),
                options: CarVisibleContentOptions(),
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
        <div></div>
      </Grid>
    </>
  );
};

export { AdminCars };
