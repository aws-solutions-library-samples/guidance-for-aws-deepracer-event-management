import React, { useEffect, useState } from 'react';
import { API } from 'aws-amplify';
import * as queries from '../graphql/queries';
//import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Grid,
  Pagination,
  Table,
  TextFilter,
  SpaceBetween,
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

import CarModelUploadModal from "./carModelUploadModal.js";
import DeleteModelModal from '../components/DeleteModelModal';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export function AdminModels() {
  const [allItems, setItems] = useState([]);
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);

  useEffect(() => {
    async function getData() {
      console.log("Collecting models...")
      const apiName = 'deepracerEventManager';
      const apiPath = 'models';

      const response = await API.get(apiName, apiPath);
      var models = response.map(function (model, i) {
        // TODO: Fix inconsistency in model.Key / model.key in /admin/model.js and /models.js
        const modelKeyPieces = (model.Key.split('/'))
        return {
          key: model.Key,
          userName: modelKeyPieces[modelKeyPieces.length - 3],
          modelName: modelKeyPieces[modelKeyPieces.length - 1],
          modelDate: dayjs(model.LastModified).format('YYYY-MM-DD HH:mm:ss (z)')
        }
      })
      setItems(models);

      console.log("Collecting cars...")
      // Get CarsOnline
      async function carsOnline() {
        const response = await API.graphql({
          query: queries.carsOnline
        });
        //console.log('carsOnline');
        setCars(response.data.carsOnline);
      }
      carsOnline();

      setIsLoading(false);
    }

    getData();

    return() => {
      // Unmounting
    }
  },[])

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['userName', 'modelName', 'modelDate'],
  });

  const {items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
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
      sorting: { defaultState: { sortingColumn: AdminModelsColumnsConfig[3], isDescending: true } },
      selection: {},
    }
  );
  const [selectedItems, setSelectedItems] = useState([]);

  const visibleContentOptions = [
    {
      label: 'Model information',
      options: [
        {
          id: 'userName',
          label: 'User name',
          editable: false,
        },
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
        header="All Models"
        description="List of all uploaded models."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
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
                  <CarModelUploadModal disabled={selectedModelsBtn} selectedModels={selectedItems} cars={cars}></CarModelUploadModal>
                </SpaceBetween>
              }
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
          loadingText='Loading models'
          visibleColumns={preferences.visibleContent}
          selectedItems={selectedItems}
          selectionType='multi'
          stickyHeader='true'
          trackBy={'key'}
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems)
            selectedItems.length ? setSelectedModelsBtn(false) : setSelectedModelsBtn(true)
          }}
          resizableColumns
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
      </Grid>
    </>
  );

}
