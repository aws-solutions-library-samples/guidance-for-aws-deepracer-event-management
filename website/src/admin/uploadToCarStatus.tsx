import { BarChart, Box, Container, Header, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { TableHeader } from '../components/tableConfig';
import { graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
import * as queries from '../graphql/queries';

import {
  colorChartsStatusCritical,
  colorChartsStatusInfo,
  colorChartsStatusLow,
  colorChartsStatusNeutral,
  colorChartsStatusPositive
} from '@cloudscape-design/design-tokens';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../components/eventSelectorModal';
import { PageLayout } from '../components/pageLayout';
import { PageTable } from '../components/pageTable';
import { onUploadsToCarCreated, onUploadsToCarUpdated } from '../graphql/subscriptions';
import i18next from '../i18n';
import { useSelectedEventContext } from '../store/contexts/storeProvider';
import {
  ColumnConfiguration,
  FilteringProperties,
} from './uploadToCarStatusTableConfig';

// Type definitions
type UploadStatus = 'Created' | 'Started' | 'InProgress' | 'Success' | 'Failed';

interface UploadToCarItem {
  status: UploadStatus;
  statusIndicator?: React.ReactNode;
  uploadStartTime?: string;
  endTime?: string;
  duration?: number;
  carName?: string;
  jobId?: string;
  modelKey?: string;
  [key: string]: any; // Allow additional properties from GraphQL
}

interface BarChartDataPoint {
  x: string | Date;
  y: number;
}

interface BarChartSeries {
  title: string;
  type: string;
  data: BarChartDataPoint[];
  color?: string;
}

interface StatusCount {
  [key: string]: number;
}

const UploadToCarStatus: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [allItems, setItems] = useState<UploadToCarItem[]>([]);
  const [horizontalBarData, setHorizontalBarData] = useState<BarChartSeries[]>([]);
  const [barData, setBarData] = useState<BarChartDataPoint[]>([]);
  const [xDomain, setXDomain] = useState<Date[]>([]);
  const [maxDuration, setMaxDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedItems, setSelectedItems] = useState<UploadToCarItem[]>([]);
  const selectedEvent = useSelectedEventContext();
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (selectedEvent?.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  function enrichStatus(data: UploadToCarItem[]): UploadToCarItem[] {
    data.forEach(element => {
      // enrich status
      if (element.status === 'Created') {
        element.statusIndicator = (
          <StatusIndicator type="info">
            {i18next.t('carmodelupload.status.created')}
          </StatusIndicator>
        );
      } else if (element.status === 'Started') {
        element.statusIndicator = (
          <StatusIndicator type="pending">
            {i18next.t('carmodelupload.status.started')}
          </StatusIndicator>
        );
      } else if (element.status === 'InProgress') {
        element.statusIndicator = (
          <StatusIndicator type="loading">
            {i18next.t('carmodelupload.status.inprogress')}
          </StatusIndicator>
        );
      } else if (element.status === 'Success') {
        element.statusIndicator = (
          <StatusIndicator type="success">
            {i18next.t('carmodelupload.status.success')}
          </StatusIndicator>
        );

        // enrich upload duration
        if (element.uploadStartTime && element.endTime) {
          const uploadStartDateTime = Date.parse(element.uploadStartTime);
          const endDateTime = Date.parse(element.endTime);
          const duration = (endDateTime - uploadStartDateTime) / 1000;
          element.duration = duration;
        }
      } else if (element.status === 'Failed') {
        element.statusIndicator = (
          <StatusIndicator type="error">{i18next.t('carmodelupload.status.error')}</StatusIndicator>
        );
      } else {
        element.statusIndicator = element.status;
      }
    });
    return data;
  }

  function getColorForStatus(status: string): string {
    let color = colorChartsStatusNeutral;
    if (status === 'Created') {
      color = colorChartsStatusInfo;
    } else if (status === 'Started') {
      color = colorChartsStatusNeutral;
    } else if (status === 'InProgress') {
      color = colorChartsStatusLow;
    } else if (status === 'Success') {
      color = colorChartsStatusPositive;
    } else if (status === 'Failed') {
      color = colorChartsStatusCritical;
    }
    return color;
  }

  useEffect(() => {
    async function listUploadsToCar() {
      setItems([]);
      const response = await graphqlMutate<{ listUploadsToCar: UploadToCarItem[] }>(
        queries.listUploadsToCar,
        { eventId: selectedEvent?.eventId }
      );
      const enrichedData = enrichStatus(response.listUploadsToCar);
      setItems(enrichedData);
      setIsLoading(false);
    }

    if (typeof selectedEvent?.eventId !== "undefined") {
      listUploadsToCar();
    }
    return () => {
      // Unmounting
    };
  }, [selectedEvent]);

  // horizontal bar chart
  useEffect(() => {
    const newHorizontalBarData: BarChartSeries[] = [];

    // Status
    const statusesRaw = allItems.map(a => a.status);
    const statuses = statusesRaw.reduce((acc: StatusCount, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    for (const [key, value] of Object.entries(statuses)) {
      const data: BarChartSeries = {
        title: key,
        type: "bar",
        data: [
          { x: "Status", y: value as number },
        ],
        color: getColorForStatus(key),
      };
      newHorizontalBarData.push(data);
    }

    // carName
    const carNamesRaw = allItems.map(a => a.carName).filter((name): name is string => !!name);
    const carNames = carNamesRaw.reduce((acc: StatusCount, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    
    for (const [key, value] of Object.entries(carNames)) {
      const data: BarChartSeries = {
        title: key,
        type: "bar",
        data: [
          { x: "Car", y: value as number },
        ],
      };
      newHorizontalBarData.push(data);
    }

    // jobId
    const jobIdsRaw = allItems.map(a => a.jobId).filter((id): id is string => !!id);
    const jobIds = jobIdsRaw.reduce((acc: StatusCount, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    
    for (const [key, value] of Object.entries(jobIds)) {
      const data: BarChartSeries = {
        title: key,
        type: "bar",
        data: [
          { x: "Job", y: value as number },
        ],
      };
      newHorizontalBarData.push(data);
    }

    setHorizontalBarData(newHorizontalBarData);
  }, [allItems]);

  // bar chart
  useEffect(() => {
    const newBarData: BarChartDataPoint[] = [];
    const newXDomain: Date[] = [];
    
    allItems.forEach(element => {
      if (typeof element.duration !== "undefined" && element.uploadStartTime) {
        const dateTime = new Date(element.uploadStartTime);
        const data: BarChartDataPoint = { x: dateTime, y: element.duration };
        newBarData.push(data);
        newXDomain.push(dateTime);
      }
    });

    newBarData.sort((a, b) => {
      const dateA = new Date(a.x);
      const dateB = new Date(b.x);
      return dateA.getTime() - dateB.getTime();
    });

    newXDomain.sort((a, b) => {
      return a.getTime() - b.getTime();
    });
    
    setBarData(newBarData);
    setXDomain(newXDomain);

    if (allItems.length > 0) {
      const max = allItems.reduce((prev, current) => {
        return (prev && prev.duration && current.duration && prev.duration > current.duration) ? prev : current;
      });
      const newMaxDuration = Math.ceil(max.duration || 0) + 3;
      setMaxDuration(newMaxDuration);
    }
  }, [allItems]);

  useEffect(() => {
    const filter = {
      eventId: selectedEvent?.eventId,
    };
    const subscription = graphqlSubscribe<{ onUploadsToCarCreated: UploadToCarItem }>(
      onUploadsToCarCreated,
      filter
    ).subscribe({
        next: (event) => {
          console.debug(
            'onUploadsToCarCreated event received',
            event.value.data.onUploadsToCarCreated
          );
          event.value.data.onUploadsToCarCreated.status = 'Created';
          const newItems = allItems.concat(event.value.data.onUploadsToCarCreated);
          const enrichedItems = enrichStatus(newItems);
          setItems(enrichedItems);
        },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);

  // monitor for updated jobs matching our JobIds
  useEffect(() => {
    const filter = {
      eventId: selectedEvent?.eventId,
    };
    const subscription = graphqlSubscribe<{ onUploadsToCarUpdated: UploadToCarItem }>(
      onUploadsToCarUpdated,
      filter
    ).subscribe({
        next: (event) => {
          const updatedData = event.value.data.onUploadsToCarUpdated;
          console.debug('onUploadsToCarUpdated event received', updatedData);
          const newItems = [...allItems];
          let currentData = newItems.find((value) => (value.modelKey === updatedData.modelKey && value.jobId === updatedData.jobId));
          
          // handle missed events
          if (currentData === undefined) {
            currentData = {} as UploadToCarItem;
            newItems.push(currentData);
            currentData.modelKey = updatedData.modelKey;
          }

          currentData.status = updatedData.status;
          if (updatedData.uploadStartTime) {
            currentData.uploadStartTime = updatedData.uploadStartTime;
          }
          if (updatedData.endTime) {
            currentData.endTime = updatedData.endTime;
          }

          const enrichedItems = enrichStatus(newItems);
          setItems(enrichedItems);
        },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);

  const columnConfiguration = ColumnConfiguration() as any;
  const filteringProperties = FilteringProperties() as any;

  const HeaderActionButtons: React.FC = () => {
    return (
      <SpaceBetween direction="horizontal" size="xs">
      </SpaceBetween>
    );
  };

  const breadcrumbs: Array<{ text: string; href?: string }> = [
    { text: t('home.breadcrumb'), href: '/' },
    { text: t('operator.breadcrumb'), href: '/admin/home' },
    { text: t('models.breadcrumb'), href: '/admin/home' },
    { text: t('upload-to-car-status.breadcrumb') }
  ];

  return (
    <div>
      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />

      <PageLayout
        helpPanelHidden={true}
        helpPanelContent={
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-cars' })}
            bodyContent={t('content', { ns: 'help-admin-cars' })}
            footerContent={t('footer', { ns: 'help-admin-cars' })}
          />
        }
        header={t('upload-to-car-status.header')}
        description={t('upload-to-car-status.description')}
        breadcrumbs={breadcrumbs as any}
      >
        <SpaceBetween direction="vertical" size="l">
          <ColumnLayout columns={2}>
            <Container {...{ textAlign: "center", fitHeight: true } as any}>
              <Header variant={"h2" as any}>{t('upload-to-car-status.horizontal-bar.header')}</Header>
              <BarChart
                series={horizontalBarData as any}
                xDomain={["Status", "Car", "Job"]}
                yDomain={[0, allItems.length]}
                ariaLabel="Stacked, horizontal bar chart"
                hideFilter
                hideLegend
                height={250}
                horizontalBars
                stackedBars
                xTitle={t('upload-to-car-status.horizontal-bar.x-title')}
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>No data available</b>
                    <Box variant="p" color="inherit">
                      There is no data available
                    </Box>
                  </Box>
                }
              />
            </Container>

            <Container {...{ textAlign: "center", fitHeight: true } as any}>
              <Header variant={"h2" as any}>{t('upload-to-car-status.upload-time.header')}</Header>
              <BarChart
                series={[
                  {
                    title: t('upload-to-car-status.upload-time.y-title'),
                    type: "bar",
                    data: barData as any
                  },
                ]}
                xDomain={xDomain as any}
                yDomain={[0, maxDuration]}
                i18nStrings={{
                  xTickFormatter: (e: Date) =>
                    e.toLocaleDateString("en-GB", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: false
                      })
                      .split(",")
                      .join("\n")
                }}
                ariaLabel="Single data series line chart"
                hideFilter
                hideLegend
                height={250}
                xTitle="Time (UTC)"
                yTitle={t('upload-to-car-status.upload-time.y-title')}
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>No data available</b>
                    <Box variant="p" color="inherit">
                      There is no data available
                    </Box>
                  </Box>
                }
              />
            </Container>
          </ColumnLayout>

          <PageTable
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            tableItems={allItems}
            columnConfiguration={columnConfiguration}
            header={
              <TableHeader
                nrSelectedItems={selectedItems.length}
                nrTotalItems={allItems.length}
                header={t('upload-to-car-status.header')}
                actions={<HeaderActionButtons />}
              />
            }
            itemsIsLoading={isLoading}
            loadingText={t('upload-to-car-status.loading')}
            localStorageKey={'cars-table-preferences'}
            trackBy={'InstanceId'}
            filteringProperties={filteringProperties}
            filteringI18nStringsName={'devices'}
          />
        </SpaceBetween>
      </PageLayout>
    </div>
  );
};

export { UploadToCarStatus };
