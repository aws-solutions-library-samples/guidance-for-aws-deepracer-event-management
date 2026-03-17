import { TableProps } from '@cloudscape-design/components';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { graphqlMutate, graphqlSubscribe } from '../../../graphql/graphqlHelpers';
import * as mutations from '../../../graphql/mutations';
import { formatAwsDateTime } from '../../../support-functions/time';

import {
  Alert,
  ProgressBar,
  StatusIndicator,
  Table
} from '@cloudscape-design/components';

import { onUploadsToCarCreated, onUploadsToCarUpdated } from '../../../graphql/subscriptions';

// Type definitions
interface Car {
  InstanceId: string;
  ComputerName: string;
  fleetId: string;
  fleetName: string;
  IpAddress: string;
}

interface Event {
  eventId: string;
  eventName: string;
}

interface ModelToUpload {
  fileMetaData: {
    key: string;
  };
  username: string;
}

interface UploadJob {
  jobId?: string;
  modelKey: string;
  carName?: string;
  status?: string;
  statusIndicator?: ReactNode;
  startTime?: string;
  uploadStartTime?: string;
  endTime?: string;
  duration?: number;
}

interface StartUploadToCarResponse {
  startUploadToCar: {
    jobId: string;
  };
}

interface UploadToCarEventData {
  jobId: string;
  modelKey: string;
  carName?: string;
  status: string;
  startTime?: string;
  uploadStartTime?: string;
  endTime?: string;
}

interface SubscriptionEvent<T> {
  value: {
    data: T;
  };
}

type GraphQLSubscription = {
  unsubscribe: () => void;
};

interface UploadModelToCarProps {
  cars: Car[];
  event: Event;
  modelsToUpload: ModelToUpload[];
}

export function UploadModelToCar({ cars, event, modelsToUpload }: UploadModelToCarProps): JSX.Element {
  const { t } = useTranslation();
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let currentProgress = 0;
    if (jobs.length > 0) {
      const jobsSuccess = jobs.filter((job) => job.status === 'Success');
      currentProgress = (jobsSuccess.length / jobs.length) * 100;
    }
    setProgress(currentProgress);
  }, [jobs, event]);

  useEffect(() => {
    const getData = async (): Promise<void> => {
      const thisJobIds: string[] = [];
      
      // Process cars sequentially to avoid race conditions with state updates
      for (const car of cars) {
        const variables = {
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

        const response = await graphqlMutate<StartUploadToCarResponse>(
          mutations.startUploadToCar,
          variables
        );
        if (response?.startUploadToCar?.jobId) {
          console.debug('startUploadToCar', response.startUploadToCar.jobId);
          thisJobIds.push(response.startUploadToCar.jobId);
        }
      }
      
      setJobIds(thisJobIds);
    };
    getData();
  }, [cars, event, modelsToUpload]);

  useEffect(() => {
    const subscriptions: GraphQLSubscription[] = [];
    
    jobIds.forEach((jobId) => {
      const filter = {
        jobId: jobId,
      };
      const subscription = graphqlSubscribe<{ onUploadsToCarCreated: UploadToCarEventData }>(
        onUploadsToCarCreated,
        filter
      ).subscribe({
        next: (event) => {
          console.debug(
            'onUploadsToCarCreated event received',
            event.value.data.onUploadsToCarCreated
          );
          const newJob: UploadJob = {
            ...event.value.data.onUploadsToCarCreated,
            status: 'Created',
            statusIndicator: (
              <StatusIndicator type="info">{t('carmodelupload.status.created')}</StatusIndicator>
            ),
          };
          setJobs((prevJobs) => prevJobs.concat(newJob));
        },
      });
      subscriptions.push(subscription);
    });

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) subscription.unsubscribe();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, jobIds]);

  // monitor for updated jobs matching our JobIds
  useEffect(() => {
    const subscriptions: GraphQLSubscription[] = [];
    
    jobIds.forEach((jobId) => {
      const filter = {
        jobId: jobId,
      };
      const subscription = graphqlSubscribe<{ onUploadsToCarUpdated: UploadToCarEventData }>(
        onUploadsToCarUpdated,
        filter
      ).subscribe({
        next: (event) => {
          const updatedData = event.value.data.onUploadsToCarUpdated;
          console.debug('onUploadsToCarUpdated event received', updatedData);
          
          setJobs((prevJobs) => {
            const newJobs = [...prevJobs];
            let currentData = newJobs.find((value) => value.modelKey === updatedData.modelKey);
            
            if (currentData === undefined) {
              currentData = { modelKey: updatedData.modelKey };
              newJobs.push(currentData);
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
              if (currentData.uploadStartTime && updatedData.endTime) {
                const uploadStartDateTime = Date.parse(currentData.uploadStartTime);
                console.log(uploadStartDateTime);
                const endDateTime = Date.parse(updatedData.endTime);
                console.log(endDateTime);
                const duration = (endDateTime - uploadStartDateTime) / 1000;
                currentData.duration = duration;
                console.log(duration);
              }
            } else if (updatedData.status === 'Failed') {
              currentData.status = updatedData.status;
              currentData.statusIndicator = (
                <StatusIndicator type="error">{t('carmodelupload.status.error')}</StatusIndicator>
              );
            } else {
              currentData.status = updatedData.status;
              currentData.statusIndicator = <>{updatedData.status}</>;
            }
            
            if (updatedData.uploadStartTime) {
              currentData.uploadStartTime = updatedData.uploadStartTime;
            }
            if (updatedData.endTime) {
              currentData.endTime = updatedData.endTime;
            }
            
            return newJobs;
          });
        },
      });
      subscriptions.push(subscription);
    });

    return () => {
      subscriptions.forEach((subscription) => {
        if (subscription) subscription.unsubscribe();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, jobIds]);

  const columnDefinitionsModern: TableProps.ColumnDefinition<UploadJob>[] = [
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
      cell: (item) => formatAwsDateTime(item.startTime) || '-',
      sortingField: 'startTime',
      width: 180,
      minWidth: 180,
    },
    {
      id: 'uploadStartTime',
      header: t('carmodelupload.uploadStartTime'),
      cell: (item) => formatAwsDateTime(item.uploadStartTime) || '-',
      sortingField: 'uploadStartTime',
      width: 180,
      minWidth: 180,
    },
    {
      id: 'endTime',
      header: t('carmodelupload.endTime'),
      cell: (item) => formatAwsDateTime(item.endTime) || '-',
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
}

