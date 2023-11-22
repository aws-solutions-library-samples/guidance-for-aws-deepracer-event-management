import { BarChart, Box, Container, Header, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { TableHeader } from '../components/tableConfig';
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

const UploadToCarStatus = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [allItems, setItems] = useState([]);
  const [horizontalBarData, setHorizontalBarData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [xDomain, setXDomain] = useState([]);
  const [maxDuration, setMaxDuration] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const selectedEvent = useSelectedEventContext();
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  function enrichStatus(data) {
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
        const uploadStartDateTime = Date.parse(element.uploadStartTime);
        const endDateTime = Date.parse(element.endTime);
        const duration = (endDateTime - uploadStartDateTime) / 1000;
        element.duration = duration;

      } else if (element.status === 'Failed') {
        element.statusIndicator = (
          <StatusIndicator type="error">{i18next.t('carmodelupload.status.error')}</StatusIndicator>
        );
      } else {
        
        element.statusIndicator = element.status;
      }
    });
    return data
  }

  function getColorForStatus(status) {
    var color = colorChartsStatusNeutral
    if (status === 'Created') {
      color = colorChartsStatusInfo
    } else if (status === 'Started') {
      color = colorChartsStatusNeutral
    } else if (status === 'InProgress') {
      color = colorChartsStatusLow
    } else if (status === 'Success') {
      color = colorChartsStatusPositive
    } else if (status === 'Failed') {
      color = colorChartsStatusCritical
    }
    return color
  }

  useEffect(() => {
    async function listUploadsToCar() {
      setItems([]);
      var response = await API.graphql({
        query: queries.listUploadsToCar,
        variables: {
          eventId: selectedEvent.eventId,
        },
      });
      const enrichedData = enrichStatus(response.data.listUploadsToCar);
      setItems(enrichedData);
      setIsLoading(false);
    }

    if(typeof selectedEvent.eventId !== "undefined") {
      listUploadsToCar();
    }
    return () => {
      // Unmounting
    };
  }, [selectedEvent]);

  // horizontal bar chart
  useEffect(() => {
    var newHorizontalBarData = [];

    // Status
    let statusesRaw = allItems.map(a => a.status);
    let statuses = statusesRaw.reduce(function (value, value2) {
      return (
          value[value2] ? ++value[value2] :(value[value2] = 1),
          value
      );
    }, {});
    for (const [key, value] of Object.entries(statuses)) {
      const data = {
        title: key,
        type: "bar",
        data: [
          { x: "Status", y: value },
        ],
        color: getColorForStatus(key),
      }
      newHorizontalBarData.push(data);
    }

    // carName
    let carNamesRaw = allItems.map(a => a.carName);
    let carNames = carNamesRaw.reduce(function (value, value2) {
      return (
          value[value2] ? ++value[value2] :(value[value2] = 1),
          value
      );
    }, {});
    for (const [key, value] of Object.entries(carNames)) {
      const data = {
        title: key,
        type: "bar",
        data: [
          { x: "Car", y: value },
        ],
        //color: getColorForStatus(key),
      }
      newHorizontalBarData.push(data);
    }

    // jobId
    let jobIdsRaw = allItems.map(a => a.jobId);
    let jobIds = jobIdsRaw.reduce(function (value, value2) {
      return (
          value[value2] ? ++value[value2] :(value[value2] = 1),
          value
      );
    }, {});
    for (const [key, value] of Object.entries(jobIds)) {
      const data = {
        title: key,
        type: "bar",
        data: [
          { x: "Job", y: value },
        ],
        //color: getColorForStatus(key),
      }
      newHorizontalBarData.push(data);
    }

    setHorizontalBarData(newHorizontalBarData);
  },[allItems]);

  // bar chart
  useEffect(() => {
    var newBarData = [];
    var newXDomain = [];
    allItems.forEach(element => {
      if(typeof element.duration !== "undefined") {
        const dateTime = new Date(element.uploadStartTime);
        const data = { x: dateTime, y: element.duration }
        newBarData.push(data);
        newXDomain.push(dateTime);
      }
    });

    newBarData.sort(function(a, b) {
      // Convert the date strings to Date objects
      let dateA = new Date(a.x);
      let dateB = new Date(b.x);
    
      // Subtract the dates to get a value that is either negative, positive, or zero
      return dateA - dateB;
    });

    newXDomain.sort(function(a, b) {
      // Convert the date strings to Date objects
      let dateA = new Date(a);
      let dateB = new Date(b);
    
      // Subtract the dates to get a value that is either negative, positive, or zero
      return dateA - dateB;
    });
    setBarData(newBarData);
    setXDomain(newXDomain);

    if (allItems.length > 0){
      const max = allItems.reduce(function(prev, current) {
        return (prev && prev.duration > current.duration) ? prev : current
      }) 
      var newMaxDuration = Math.ceil(max.duration)+3;
      setMaxDuration(newMaxDuration);
    }

  },[allItems]);

  useEffect(() => {
    const filter = {
      eventId: selectedEvent.eventId,
    };
    const subscription = API.graphql(graphqlOperation(onUploadsToCarCreated, filter)).subscribe(
      {
        next: (event) => {
          console.debug(
            'onUploadsToCarCreated event received',
            event.value.data.onUploadsToCarCreated
          );
          event.value.data.onUploadsToCarCreated.status = 'Created';
          var newItems = allItems.concat(event.value.data.onUploadsToCarCreated);
          newItems = enrichStatus(newItems);
          setItems(newItems);
        },
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);

  // monitor for updated jobs matching our JobIds
  useEffect(() => {
    const filter = {
      eventId: selectedEvent.eventId,
    };
    const subscription = API.graphql(graphqlOperation(onUploadsToCarUpdated, filter)).subscribe(
      {
        next: (event) => {
          var updatedData = event.value.data.onUploadsToCarUpdated;
          console.debug('onUploadsToCarUpdated event received', updatedData);
          let newItems = [...allItems];
          var currentData = newItems.find((value) => (value.modelKey === updatedData.modelKey && value.jobId === updatedData.jobId));
          
          // handle missed events
          if (currentData === undefined) {
            currentData = {};
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

          newItems = enrichStatus(newItems);
          setItems(newItems);
        },
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);



  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const HeaderActionButtons = () => {
    return (
      <SpaceBetween direction="horizontal" size="xs">
      </SpaceBetween>
    );
  };

  const breadcrumbs = [
    { text: t('home.breadcrumb'), href: '/' },
    { text: t('operator.breadcrumb'), href: '/admin/home' },
    { text: t('models.breadcrumb'), href: '/admin/home' },
    { text: t('upload-to-car-status.breadcrumb') }
  ]

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
        breadcrumbs={breadcrumbs}
      >
        <SpaceBetween direction="vertical" size="l">
          <ColumnLayout columns={2}>
            <Container textAlign="center" fitHeight={true}>
              <Header variant="h2">{t('upload-to-car-status.horizontal-bar.header')}</Header>
              <BarChart
                series={horizontalBarData}
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

            <Container textAlign="center" fitHeight={true}>
              <Header variant="h2">{t('upload-to-car-status.upload-time.header')}</Header>
              <BarChart
                series={[
                  {
                    title: t('upload-to-car-status.upload-time.y-title'),
                    type: "bar",
                    data: barData
                  },
                ]}
                xDomain={xDomain}
                yDomain={[0, maxDuration]}
                i18nStrings={{
                  xTickFormatter: e =>
                    e.toLocaleDateString("en-GB", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: !1
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
            //selectionType="multi"
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
