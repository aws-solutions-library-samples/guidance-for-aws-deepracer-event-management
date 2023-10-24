import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { TableHeader } from '../components/tableConfig';

import { useTranslation } from 'react-i18next';
import {
  ColumnConfiguration,
  FilteringProperties,
} from '../components/devices-table/deviceTableConfig';
import EditCarsModal from '../components/editCarsModal';
import { PageLayout } from '../components/pageLayout';
import { PageTable } from '../components/pageTable';
import * as queries from '../graphql/queries';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';

const AdminDevices = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
    setSelectedItems([]);
    setIsLoading(false);
    setItems(response.data.carsOnline);

    console.debug(response);
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

  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  function getLabelSync(instanceId) {
    API.graphql({
      query: queries.carPrintableLabel,
      variables: {
        instanceId: instanceId,
      },
    }).then((response) => {
      const labelURL = response.data.carPrintableLabel.toString();
      window.open(labelURL);
    });
  }

  function getLabels(event) {
    event.preventDefault();

    selectedItems.map((selectedCar) => {
      const instanceId = selectedCar.InstanceId;
      getLabelSync(instanceId);
    });
  }

  const HeaderActionButtons = () => {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <ButtonDropdown
          items={[
            { text: t('devices.online'), id: 'Online', disabled: false },
            {
              text: t('devices.offline'),
              id: 'Offline',
              disabled: false,
            },
          ]}
          onItemClick={({ detail }) => {
            setOnline(detail.id);
            setIsLoading(true);
          }}
        >
          {online}
        </ButtonDropdown>
        <EditCarsModal
          disabled={selectedItems.length === 0}
          setRefresh={setRefresh}
          selectedItems={selectedItems}
          online={onlineBool}
          variant="primary"
        />
        <Button variant="primary" onClick={getLabels} disabled={selectedItems.length === 0}>
          {selectedItems.length > 1
            ? t('label-printer.download-printable-labels')
            : t('label-printer.download-printable-label')}
        </Button>
      </SpaceBetween>
    );
  };

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('devices.breadcrumb') });

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-cars' })}
          bodyContent={t('content', { ns: 'help-admin-cars' })}
          footerContent={t('footer', { ns: 'help-admin-cars' })}
        />
      }
      header={t('devices.header')}
      description={t('devices.description')}
      breadcrumbs={breadcrumbs}
    >
      <PageTable
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        tableItems={allItems}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={allItems.length}
            header={t('devices.header')}
            actions={<HeaderActionButtons />}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('devices.loading')}
        localStorageKey={'cars-table-preferences'}
        trackBy={'InstanceId'}
        filteringProperties={filteringProperties}
        filteringI18nStringsName={'devices'}
      />
    </PageLayout>
  );
};

export { AdminDevices };
