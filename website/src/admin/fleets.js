import { API } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as mutations from '../graphql/mutations';

import { ContentHeader } from '../components/ContentHeader';
import { ListOfFleets } from '../components/ListOfFleets';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Box,
  Button,
  Container,
  Form,
  FormField,
  Grid,
  Header,
  Input,
  Modal,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import { DefaultPreferences, EmptyState, MatchesCountText } from '../components/TableConfig';

const AdminFleets = () => {
  const { t } = useTranslation();

  const [newFleet, setNewFleet] = useState('');
  const [newFleetErrorText, setNewFleetErrorText] = useState('');
  const [selectedFleet, setSelectedFleet] = useState([]);
  const [addButtonDisabled, setAddButtonDisabled] = useState(true);
  const [deleteButtonDisabled, setDeleteButtonDisabled] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const fleets = ListOfFleets(setIsLoading);

  // Add Fleet
  async function addFleet(newFleet) {
    if (newFleet.match(/^[a-zA-Z0-9-_]+$/)) {
      if (
        fleets
          .map((fleets) => {
            return fleets.fleetName;
          })
          .includes(newFleet)
      ) {
        // console.log('already exists');
        setNewFleetErrorText(t('fleets.error-exists'));
      } else {
        // console.log('match')
        const response = await API.graphql({
          query: mutations.addFleet,
          variables: {
            fleetName: newFleet,
          },
        });
        setNewFleetErrorText('');
        setNewFleet('');
        return response;
      }
    } else {
      setNewFleetErrorText(t('fleets.error-text-regex'));
    }
  }

  // Delete Fleet
  async function deleteFleet() {
    // console.log(selectedFleet[0].fleetId);
    const response = await API.graphql({
      query: mutations.deleteFleet,
      variables: {
        fleetId: selectedFleet[0].fleetId,
      },
    });
    setDeleteButtonDisabled(true);
    // console.log(response.data.deleteFleet);
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['fleetName', 'fleetId', 'createdAt'],
  });

  const columnDefinitions = [
    {
      id: 'fleetName',
      header: t('fleets.fleet-name'),
      cell: (item) => item.fleetName || '-',
      sortingField: 'fleetName',
    },
    {
      id: 'fleetId',
      header: t('fleets.fleet-id'),
      cell: (item) => item.fleetId || '-',
    },
    {
      id: 'createdAt',
      header: t('fleets.created-at'),
      cell: (item) => item.createdAt || '-',
      sortingField: 'createdAt',
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(fleets, {
      filtering: {
        empty: <EmptyState title={t('fleets.no-fleet')} subtitle={t('fleets.no-fleet-message')} />,
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
      sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
      selection: {},
    });

  const fleetsTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedFleet(detail.selectedItems);
        setDeleteButtonDisabled(false);
      }}
      selectedItems={selectedFleet}
      selectionType="single"
      columnDefinitions={columnDefinitions}
      items={items}
      loading={isLoading}
      loadingText={t('fleets.loading')}
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('fleets.filter-caars')}
        />
      }
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                disabled={deleteButtonDisabled}
                iconName="status-warning"
                onClick={() => {
                  setDeleteModalVisible(true);
                }}
              >
                {t('fleets.delete-fleet')}
              </Button>
            </SpaceBetween>
          }
        >
          {t('fleets.table-header')}
        </Header>
      }
    />
  );

  return (
    <>
      <ContentHeader
        header={t('fleets.header')}
        description={t('fleets.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('fleets.breadcrumb') },
        ]}
      />
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <SpaceBetween direction="vertical" size="l">
          <Container textAlign="center">
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={addButtonDisabled}
                    variant="primary"
                    onClick={() => {
                      addFleet(newFleet);
                    }}
                  >
                    {t('fleets.add-fleet')}
                  </Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween direction="vertical" size="l">
                <FormField label={t('fleets.add-fleet')} errorText={newFleetErrorText}>
                  <Input
                    value={newFleet}
                    placeholder={t('fleets.placeholder')}
                    onChange={(fleet) => {
                      setNewFleet(fleet.detail.value);
                      if (newFleet.length > 0) {
                        setAddButtonDisabled(false);
                      }
                    }}
                  />
                </FormField>
              </SpaceBetween>
            </Form>
          </Container>

          {fleetsTable}
        </SpaceBetween>
        <div></div>
      </Grid>

      {/* delete modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  deleteFleet();
                  setDeleteModalVisible(false);
                }}
              >
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.delete-fleet')}
      >
        {t('fleets.delete-warning')}: <br></br>{' '}
        {selectedFleet.map((selectedFleet) => {
          return selectedFleet.fleetName + ' ';
        })}
      </Modal>
    </>
  );
};

export { AdminFleets };
