import {
  Alert,
  Badge,
  ProgressBar,
  Table,
  TableProps,
} from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { graphqlMutate } from '../../../graphql/graphqlHelpers';
import * as mutations from '../../../graphql/mutations';
import * as queries from '../../../graphql/queries';
import { useInterval } from '../../../hooks/useInterval';
import { Car, Model } from '../../../types/domain';

// Type definitions
interface StatusModelContentProps {
  selectedModels: Model[];
  selectedCars: Car[];
  modelsTotalCount: number;
}

interface UploadResult {
  ModelName: string;
  CommandId: string;
  Status: string;
}

interface UploadModelToCarResponse {
  uploadModelToCar: {
    ssmCommandId: string;
  };
}

interface GetUploadStatusResponse {
  getUploadModelToCarStatus: {
    ssmCommandStatus: string;
  };
}

/**
 * Legacy upload component using polling-based status checks
 */
export const StatusModelContent: React.FC<StatusModelContentProps> = (props) => {
  const { t } = useTranslation();

  const [seconds, setSeconds] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [results, setResults] = useState<UploadResult[]>([]);
  const [commandId, setCommandId] = useState<string>('');
  const [currentInstanceId, setCurrentInstanceId] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<Model | null>(null);

  async function uploadModelToCar(car: Car, model: Model): Promise<void> {
    const response = await graphqlMutate<UploadModelToCarResponse>(
      mutations.uploadModelToCar,
      {
        entry: {
          carInstanceId: car.InstanceId,
          modelKey: model.fileMetaData?.key,
          username: model.username,
        },
      }
    );
    if (response?.uploadModelToCar) {
      setResult(response.uploadModelToCar.ssmCommandId);
      setCommandId(response.uploadModelToCar.ssmCommandId);
    }

    setCurrentInstanceId(car.InstanceId || '');
    setCurrentModel(model);
    setUploadStatus('InProgress');
  }

  async function uploadModelToCarStatus(
    InstanceId: string, 
    CommandId: string, 
    model: Model
  ): Promise<string | undefined> {
    if (InstanceId === '' || CommandId === '') {
      return undefined;
    }

    const api_response = await graphqlMutate<GetUploadStatusResponse>(
      queries.getUploadModelToCarStatus,
      { carInstanceId: InstanceId, ssmCommandId: CommandId }
    );
    const ssmCommandStatus = api_response?.getUploadModelToCarStatus?.ssmCommandStatus || '';

    const modelUser = model.username || '';
    const modelName = model.modelname || '';

    const resultToAdd: UploadResult = {
      ModelName: modelUser + '-' + modelName,
      CommandId: CommandId,
      Status: ssmCommandStatus,
    };
    
    const tempResultsArray: UploadResult[] = [];
    let updatedElement = false;
    
    for (const currentResult of results) {
      if (currentResult.CommandId === CommandId) {
        tempResultsArray.push(resultToAdd);
        updatedElement = true;
      } else {
        tempResultsArray.push(currentResult);
      }
    }

    // If result hasn't been updated because it doesn't exist, add the element
    if (!updatedElement) {
      tempResultsArray.push(resultToAdd);
    }

    setResult(ssmCommandStatus);
    setUploadStatus(ssmCommandStatus);
    setResults(tempResultsArray);

    return ssmCommandStatus;
  }

  useInterval(() => {
    setSeconds(seconds + 1);

    const models = props.selectedModels;
    const car = props.selectedCars[0];

    if (uploadStatus !== 'InProgress') {
      if (models.length > 0) {
        setUploadStatus('InProgress');
        const model = models.pop();
        if (model) {
          uploadModelToCar(car, model);
        }
      }
    } else {
      if (currentModel) {
        uploadModelToCarStatus(currentInstanceId, commandId, currentModel);
      }
    }
  }, 500);

  const columnDefinitions: TableProps.ColumnDefinition<UploadResult>[] = [
    {
      id: 'ModelName',
      header: t('carmodelupload.modelname'),
      cell: (item) => item.ModelName || '-',
      sortingField: 'ModelName',
    },
    {
      id: 'CommandId',
      header: t('carmodelupload.commandid'),
      cell: (item) => item.CommandId || '-',
      sortingField: 'CommandId',
    },
    {
      id: 'Status',
      header: t('carmodelupload.status'),
      cell: (item) => t('carmodelupload.status.' + item.Status) || '-',
      sortingField: 'Status',
    },
  ];

  return (
    <div>
      <Badge color="blue">{t('carmodelupload.legacy')}</Badge>
      <Table
        columnDefinitions={columnDefinitions}
        items={results}
        variant="embedded"
        loadingText={t('carmodelupload.loading')}
        sortingDisabled
        empty={
          <Alert visible={true} dismissAriaLabel="Close alert" header="Starting">
            {t('carmodelupload.please-wait')}
          </Alert>
        }
        header={
          <ProgressBar
            value={
              ((props.modelsTotalCount - props.selectedModels.length) / props.modelsTotalCount) *
              100
            }
          />
        }
      />
    </div>
  );
};
