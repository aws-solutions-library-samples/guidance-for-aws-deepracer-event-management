import React, { useEffect, useState } from 'react';
import { API } from 'aws-amplify';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Grid,
  Header,
  Link,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import { ContentHeader } from '../components/ContentHeader';
import {
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

export function AdminGroups() {
  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  const apiName = 'deepracerEventManager';

  useEffect(() => {
    const getData = async() => {
      const apiPath = 'admin/groups';

      const groups = await API.get(apiName, apiPath);
      setItems(groups.Groups);
      setIsLoading(false);
    }

    getData();

    return() => {
      // Unmounting
    }

  },[]);

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['groupName', 'description'],
  });

  const columnsConfig = [
    {
      id: 'groupName',
      header: 'Group name',
      cell: item => (
        <div>
          <Link href={window.location.href + "/" + item.GroupName}>{item.GroupName}</Link>
        </div>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      cell: item => item.description || '-',
      sortingField: 'description',
    },
    {
      id: 'creationDate',
      header: 'Creation date',
      cell: item => dayjs(item.creationDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'creationDate',
    }
  ];

  const visibleContentOptions = [
    {
      label: 'Group information',
      options: [
        {
          id: 'groupName',
          label: 'Group name',
          editable: false,
        },
        {
          id: 'description',
          label: 'Description',
          editable: false,
        },
        {
          id: 'creationDate',
          label: 'Creation date',
        }
      ]
    }
  ]

  const {items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    allItems,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No groups"
            subtitle="No groups have been defined."
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
      sorting: { defaultState: { sortingColumn: columnsConfig[0] } },
      selection: {},
    }
  );

  return (
    <>
      <ContentHeader
        header="Groups admin"
        description="List of user groups."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
          { text: "Groups" }
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
              Groups
            </Header>
          }
          columnDefinitions={columnsConfig}
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
          loadingText='Loading groups'
          visibleColumns={preferences.visibleContent}
          selectedItems={selectedItems}
          trackBy='GroupName'
          resizableColumns
          preferences={
            <CollectionPreferences
              title='Preferences'
              confirmLabel='Confirm'
              cancelLabel='Cancel'
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference('groups')}
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
