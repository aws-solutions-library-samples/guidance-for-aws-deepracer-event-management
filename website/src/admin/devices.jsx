import { Button, ButtonDropdown, SpaceBetween } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import { default as React, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCarsApi } from '../hooks/useCarsApi';
import { usePermissions } from '../hooks/usePermissions';
import { useStore } from '../store/store';

import {
  ColumnConfiguration,
  FilteringProperties,
} from '../components/devices-table/deviceTableConfig';
import EditCarsModal from '../components/editCarsModal';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { PageTable } from '../components/pageTable';
import { TableHeader } from '../components/tableConfig';
import * as queries from '../graphql/queries';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';

const AdminDevices = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [state] = useStore();
  const [carsToDisplay, setCarsToDisplay] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [online, setOnline] = useState('Online');
  const [onlineBool, setOnlineBool] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [columnConfiguration] = useState(() => ColumnConfiguration());
  const [filteringProperties] = useState(() => FilteringProperties());
  const permissions = usePermissions();
  const { triggerReload } = useCarsApi(permissions.api.cars);

  const reloadCars = async () => {
    setIsLoading(true);
    await triggerReload();
  };

  useEffect(() => {
    setIsLoading(state.cars.isLoading);
  }, [state.cars.isLoading]);

  useEffect(() => {
    var onlineBool_ = online === 'Online';
    const updatedCars = state.cars.cars.filter((car) =>
      onlineBool_ ? car.PingStatus === 'Online' : car.PingStatus !== 'Online'
    );
    setOnlineBool(onlineBool_);
    setCarsToDisplay(updatedCars);
    setIsLoading(state.cars.isLoading);
    return () => {
      // Unmounting
    };
  }, [online, state.cars]);

  useEffect(() => {
    if (refresh) {
      setRefresh(false);
    }
    return () => {
      // Unmounting
    };
  }, [refresh]);

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

    selectedItems.forEach((selectedCar) => {
      const instanceId = selectedCar.InstanceId;
      getLabelSync(instanceId);
    });
  }

  const HeaderActionButtons = () => {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button iconName="refresh" variant="normal" disabled={isLoading} onClick={reloadCars} />
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
        tableItems={carsToDisplay}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={carsToDisplay.length}
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
