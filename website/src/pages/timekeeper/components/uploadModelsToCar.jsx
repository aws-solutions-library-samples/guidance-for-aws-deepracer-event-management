import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import * as mutations from '../../../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'
import { useTranslation } from 'react-i18next';

import {
  Alert,
  ProgressBar,
  StatusIndicator,
  Table
} from '@cloudscape-design/components';


import { onUploadsToCarCreated, onUploadsToCarUpdated } from '../../../graphql/subscriptions';

export function UploadModelToCar(props) {
  const { t } = useTranslation();
  const cars = props.cars;
  const event = props.event;
  const modelsToUpload = props.modelsToUpload;
  const [jobIds, setJobIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    var currentProgress = 0;
    if (jobs.length > 0) {
      const jobsSuccess = jobs.filter((job) => job.status === 'Success');
      currentProgress = (jobsSuccess.length / jobs.length) * 100;
    }
    setProgress(currentProgress);
  }, [jobs, event]);

  useEffect(() => {
    const getData = async () => {
      var thisJobIds = [];
      await cars.forEach(async (car) => {
        var variables = {
          carInstanceId: car.InstanceId,
          carName: car.ComputerName,
          carFleetId: car.fleetId,
          carFleetName: car.fleetName,
          carIpAddress: car.IpAddress,
          eventId: event.eventId,
          eventName: event.eventName,
          modelData: modelsToUpload.map((modelToUpload) => {
            return {
              modelKey: modelToUpload.fileMetaData.key,
              username: modelToUpload.username,
            };
          }),
        };
        console.debug('event', event);
        console.debug('variables', variables);

        var response = await API.graphql({
          query: mutations.startUploadToCar,
          variables: variables,
        });
        console.debug('startUploadToCar', response.data.startUploadToCar.jobId);
        //if (Array.isArray(localJobIds)) {

        //console.log('jobIds2', thisJobIds)
        thisJobIds.push(response.data.startUploadToCar.jobId);
        //console.log('jobIds3', thisJobIds)
        setJobIds(thisJobIds);
        //}
      }, []);
    };
    getData();
  }, [cars, event, modelsToUpload]);

  useEffect(() => {
    var subscriptions = [];
    jobIds.forEach((jobId) => {
      const filter = {
        jobId: jobId,
      };
      const subscription = API.graphql(graphqlOperation(onUploadsToCarCreated, filter)).subscribe(
        {
          next: (event) => {
            console.debug(
              'onUploadsToCarCreated event received',
              event.value.data.onUploadsToCarCreated
            );
            event.value.data.onUploadsToCarCreated.status = 'Created';
            event.value.data.onUploadsToCarCreated.statusIndicator = (
              <StatusIndicator type="info">{t('carmodelupload.status.created')}</StatusIndicator>
            );
            setJobs(jobs.concat(event.value.data.onUploadsToCarCreated));
          },
        }
      );
      subscriptions.push(subscription);
    }, subscriptions);

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) subscription.unsubscribe();
      });
    };
  }, [t, jobs, jobIds]);

  // monitor for updated jobs matching our JobIds
  useEffect(() => {
    var subscriptions = [];
    jobIds.forEach((jobId) => {
      const filter = {
        jobId: jobId,
      };
      const subscription = API.graphql(graphqlOperation(onUploadsToCarUpdated, filter)).subscribe(
        {
          next: (event) => {
            var updatedData = event.value.data.onUploadsToCarUpdated;
            console.debug('onUploadsToCarUpdated event received', updatedData);
            let newJobs = [...jobs];
            var currentData = newJobs.find((value) => value.modelKey === updatedData.modelKey);
            if (currentData === undefined) {
              currentData = {};
              newJobs.push(currentData);
              currentData.modelKey = updatedData.modelKey;
            }

            if (updatedData.status === 'Created') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="info">
                  {t('carmodelupload.status.created')}
                </StatusIndicator>
              );
            } else if (updatedData.status === 'Started') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="pending">
                  {t('carmodelupload.status.started')}
                </StatusIndicator>
              );
            } else if (updatedData.status === 'InProgress') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="loading">
                  {t('carmodelupload.status.inprogress')}
                </StatusIndicator>
              );
            } else if (updatedData.status === 'Success') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="success">
                  {t('carmodelupload.status.success')}
                </StatusIndicator>
              );
              // enrich upload duration
              console.log(currentData);
              const uploadStartDateTime = Date.parse(currentData.uploadStartTime);
              console.log(uploadStartDateTime);
              const endDateTime = Date.parse(updatedData.endTime);
              console.log(endDateTime);
              const duration = (endDateTime - uploadStartDateTime) / 1000;
              currentData.duration = duration;
              console.log(duration);
            } else if (updatedData.status === 'Failed') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="error">{t('carmodelupload.status.error')}</StatusIndicator>
              );
            } else {
              currentData.status = updatedData.status;
              currentData.statusIndicator = updatedData.status;
            }
            if (updatedData.uploadStartTime) {
              currentData.uploadStartTime = updatedData.uploadStartTime;
            }
            if (updatedData.endTime) {
              currentData.endTime = updatedData.endTime;
            }
            setJobs(newJobs);
          },
        }
      );
      subscriptions.push(subscription);
    }, subscriptions);

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) subscription.unsubscribe();
      });
    };
  }, [t, jobs, jobIds]);

  const columnDefinitionsModern = [
    {
      id: 'Status',
      header: t('carmodelupload.status'),
      cell: (item) => item.statusIndicator || '-',
      sortingField: 'Status',
      width: 140,
      minWidth: 140,
    },
    {
      id: 'modelKey',
      header: t('carmodelupload.modelname'),
      cell: (item) => item.modelKey.split('/')[item.modelKey.split('/').length - 1] || '-',
      sortingField: 'modelKey',
      width: 200,
      minWidth: 200,
    },
    {
      id: 'carName',
      header: t('carmodelupload.carName'),
      cell: (item) => item.carName || '-',
      sortingField: 'carName',
      width: 150,
      minWidth: 150,
    },
    {
      id: 'startTime',
      header: t('carmodelupload.startTime'),
      cell: (item) => item.startTime || '-',
      sortingField: 'startTime',
      width: 180,
      minWidth: 180,
    },
    {
      id: 'uploadStartTime',
      header: t('carmodelupload.uploadStartTime'),
      cell: (item) => item.uploadStartTime || '-',
      sortingField: 'uploadStartTime',
      width: 180,
      minWidth: 180,
    },
    {
      id: 'endTime',
      header: t('carmodelupload.endTime'),
      cell: (item) => item.endTime || '-',
      sortingField: 'endTime',
      width: 180,
      minWidth: 180,
    },
    {
      id: 'duration',
      header: t('carmodelupload.duration'),
      cell: (item) => item.duration || '-',
      sortingField: 'duration',
      width: 150,
      minWidth: 150,
    },
  ];

  return (
    <div>
      <Table
        columnDefinitions={columnDefinitionsModern}
        items={jobs}
        loadingText={t('carmodelupload.loading')}
        sortingDisabled
        empty={
          <Alert visible={true} dismissAriaLabel="Close alert" header="Starting">
            {t('carmodelupload.please-wait')}
          </Alert>
        }
        header={<ProgressBar value={progress} />}
      />
    </div>
  );
};

