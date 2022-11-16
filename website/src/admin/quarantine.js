import React, { useEffect, useState } from 'react';
import { API } from 'aws-amplify';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Grid,
  Pagination,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import { ContentHeader } from '../components/ContentHeader';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export function AdminQuarantine() {
  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getQuarantinedModels() {
      console.log("Collecting models...")

      const apiName = 'deepracerEventManager';
      const apiPath = 'admin/quarantinedmodels';

      const response = await API.get(apiName, apiPath);
      var models = response.map(function (model, i) {
        const modelKeyPieces = (model.Key.split('/'))
        return {
          id: i,
          userName: modelKeyPieces[modelKeyPieces.length - 3],
          modelName: modelKeyPieces[modelKeyPieces.length - 1],
          modelDate: dayjs(model.LastModified).format('YYYY-MM-DD HH:mm:ss (z)')
        }
      })
      setItems(models);

      setIsLoading(false);
    }

    getQuarantinedModels();

    return () => {
      // Unmounting
    }
  }, [])

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['userName', 'modelName', 'modelDate'],
  });

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    allItems,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No models"
            subtitle="No quarantined models to display."
          />
        ),
        noMatch: (
          <EmptyState
            title="No matches"
            subtitle="We can’t find a match."
            action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: AdminModelsColumnsConfig[3], isDescending: true } },
      selection: {},
    }
  );
  const { selectedItems } = collectionProps;

  const visibleContentOptions = [
    {
      label: 'Model information',
      options: [
        {
          id: 'modelName',
          label: 'Model name',
          editable: false,
        },
        {
          id: 'modelDate',
          label: 'Upload date',
        }
      ]
    }
  ]

  return (
    <>
      <ContentHeader
        header="Quarantined Models"
        description="List of all quarantined models."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
          { text: "Quarantined Models" },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={selectedItems.length ? `(${selectedItems.length}/${allItems.length})` : `(${allItems.length})`}
            >
              Models
            </Header>
          }
          columnDefinitions={AdminModelsColumnsConfig}
          items={items}
          pagination={
            <Pagination {...paginationProps}
              ariaLabels={{
                nextPageLabel: 'Next page',
                previousPageLabel: 'Previous page',
                pageLabel: pageNumber => `Go to page ${pageNumber}`,
              }}
            />}
          filter={
            <TextFilter
              {...filterProps}
              countText={MatchesCountText(filteredItemsCount)}
              filteringAriaLabel='Filter models'
            />
          }
          loading={isLoading}
          loadingText="Loading models"
          visibleColumns={preferences.visibleContent}
          preferences={
            <CollectionPreferences
              title='Preferences'
              confirmLabel='Confirm'
              cancelLabel='Cancel'
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference('models')}
              visibleContentPreference={{
                title: 'Select visible columns',
                options: visibleContentOptions,
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
        <div></div>
      </Grid>
    </>
  );

}
