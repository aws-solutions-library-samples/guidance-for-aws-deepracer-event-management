import React, { useEffect, useState } from 'react';
import { Auth, Storage } from 'aws-amplify';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Grid,
  Header,
  Pagination,
  Table,
  TextFilter,
  SpaceBetween,
} from '@cloudscape-design/components';

import { ContentHeader } from './components/ContentHeader';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  UserModelsColumnsConfig,
  WrapLines,
} from './components/TableConfig';

import DeleteModelModal from './components/DeleteModelModal';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export function Models() {
  const [allItems, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);

  useEffect(() => {
    const getData = async () => {

      Auth.currentAuthenticatedUser().then(user => {
        const username = user.username;
        const s3Path = username + "/models";
        Storage.list(s3Path, { level: 'private' }).then(models => {
          if (models !== undefined) {
            var userModels = models.map(function (model, i) {
              const modelKeyPieces = (model.key.split('/'))
              return {
                key: model.key,
                modelName: modelKeyPieces[modelKeyPieces.length - 1],
                modelDate: dayjs(model.lastModified).format('YYYY-MM-DD HH:mm:ss (z)')
              }
            })
            setItems(userModels);
            setIsLoading(false);
          }
        })
      })
        .catch((err) => {
          console.log(err);
        })
    }

    getData();

    return () => {
      // Unmounting
    }
  }, []);

  const removeItem = (key) => {
    setSelectedModelsBtn(true);
    setItems(items =>
      items.filter(items => items.key !== key)
    )
    setSelectedItems(items =>
      items.filter(items => items.key !== key)
    )
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['modelName', 'modelDate'],
  });

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    allItems,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No models"
            subtitle="No models to display."
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
      sorting: { defaultState: { sortingColumn: UserModelsColumnsConfig[2], isDescending: true } },
      selection: {},
    }
  );

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
        header="Models"
        description="List of your uploaded models."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Models" },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={selectedItems.length ? `(${selectedItems.length}/${allItems.length})` : `(${allItems.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <DeleteModelModal disabled={selectedModelsBtn} selectedItems={selectedItems} removeItem={removeItem} variant="primary" />
                </SpaceBetween>
              }
            >
              Models
            </Header>
          }
          columnDefinitions={UserModelsColumnsConfig}
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
          loadingText='Loading models'
          visibleColumns={preferences.visibleContent}
          selectedItems={selectedItems}
          selectionType='multi'
          stickyHeader='true'
          trackBy='modelName'
          resizableColumns
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems)
            selectedItems.length ? setSelectedModelsBtn(false) : setSelectedModelsBtn(true)
          }}
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
