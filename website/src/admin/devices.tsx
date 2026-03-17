import { Button, ButtonDropdown, SpaceBetween, BreadcrumbGroupProps } from '@cloudscape-design/components';
import { default as React, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { useCarCmdApi } from '../hooks/useCarsApi';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';
import { Car } from '../types/domain';

type OnlineStatus = 'Online' | 'Offline';

const AdminDevices: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [state, dispatch] = useStore();
  const [carsToDisplay, setCarsToDisplay] = useState<Car[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedItems, setSelectedItems] = useState<Car[]>([]);
  const [online, setOnline] = useState<OnlineStatus>('Online');
  const [onlineBool, setOnlineBool] = useState<boolean>(true);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [columnConfiguration] = useState(() => ColumnConfiguration());
  const [filteringProperties] = useState(() => FilteringProperties());
  const { getLabelSync } = useCarCmdApi();

  const reloadCars = async (): Promise<void> => {
    setIsLoading(true);
    setRefresh(true);
    dispatch('REFRESH_CARS', !onlineBool);
  };

  useEffect(() => {
    setIsLoading(state.cars?.isLoading ?? false);
  }, [state.cars]);

  useEffect(() => {
    const onlineBool_ = online === 'Online';
    const updatedCars = (state.cars?.cars ?? []).filter((car) =>
      onlineBool_ ? car.PingStatus === 'Online' : car.PingStatus !== 'Online'
    );
    setOnlineBool(onlineBool_);
    setCarsToDisplay(updatedCars);
    setIsLoading(state.cars?.isLoading ?? false);
    return () => {
      // Unmounting
    };
  }, [online, state.cars]);

  useEffect(() => {
    if (refresh) {
      setSelectedItems([]);
      setRefresh(false);
    }
    return () => {
      // Unmounting
    };
  }, [refresh]);

  function getLabels(event: React.MouseEvent): void {
    event.preventDefault();

    selectedItems.forEach((selectedCar) => {
      getLabelSync(selectedCar.InstanceId, selectedCar.ComputerName);
    });
  }

  const HeaderActionButtons: React.FC = () => {
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
            setOnline(detail.id as OnlineStatus);
            setSelectedItems([]);
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
        <Button 
          variant="primary" 
          onClick={() => getLabels({} as React.MouseEvent)} 
          disabled={selectedItems.length === 0}
        >
          {selectedItems.length > 1
            ? t('label-printer.download-printable-labels')
            : t('label-printer.download-printable-label')}
        </Button>
      </SpaceBetween>
    );
  };

  const breadcrumbs: BreadcrumbGroupProps.Item[] = Breadcrumbs();
  breadcrumbs.push({ text: t('devices.breadcrumb'), href: '#' });

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
            actions={<HeaderActionButtons /> as any}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('devices.loading')}
        localStorageKey={'cars-table-preferences'}
        trackBy={'InstanceId'}
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName={'devices'}
      />
    </PageLayout>
  );
};

export { AdminDevices };
