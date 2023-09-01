import { SpaceBetween } from '@cloudscape-design/components';
import { Auth, Storage } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { DeleteModelModal } from './components/deleteModelModal';

import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import { ColumnConfiguration, FilteringProperties } from '../../components/tableModelsConfigRacer';
import { formatAwsDateTime } from '../../support-functions/time';
import { ModelUpload } from './components/modelUpload';

export const ModelMangement = () => {
  const { t } = useTranslation(['translation', 'help-model-management']);

  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      Auth.currentAuthenticatedUser()
        .then((user) => {
          const username = user.username;
          const s3Path = username + '/models';
          Storage.list(s3Path, { level: 'private', pageSize: 200 }).then((models) => {
            if (models !== undefined) {
              var userModels = models.results.map(function (model) {
                const modelKeyPieces = model.key.split('/');
                return {
                  key: model.key,
                  modelName: modelKeyPieces[modelKeyPieces.length - 1],
                  modelDate: formatAwsDateTime(model.lastModified),
                };
              });
              setModels(userModels);
              setIsLoading(false);
            }
          });
        })
        .catch((err) => {
          console.debug(err);
        });
    };

    getData();

    return () => {
      // Unmounting
    };
  }, []);

  const removeModelHandler = (key) => {
    setModels((items) => items.filter((items) => items.key !== key));
    setSelectedModels((items) => items.filter((items) => items.key !== key));
  };

  const addModelHandler = (newItem) => {
    setModels((items) => {
      const index = items.findIndex((item) => item.key === newItem.key);
      console.info(index);
      if (index > -1) {
        const updatedItems = [...items];
        updatedItems[newItem.key] = newItem;
        return updatedItems;
      } else {
        return [...items, newItem];
      }
    });
  };

  // Table config
  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <ModelUpload addModel={addModelHandler} />
      <DeleteModelModal
        disabled={selectedModels.length === 0}
        selectedModels={selectedModels}
        removeModel={removeModelHandler}
        variant="primary"
      />
    </SpaceBetween>
  );

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-model-management' })}
          bodyContent={t('content', { ns: 'help-model-management' })}
          footerContent={t('footer', { ns: 'help-model-management' })}
        />
      }
      header={t('models.header')}
      breadcrumbs={[{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]}
    >
      <PageTable
        selectedItems={selectedModels}
        setSelectedItems={setSelectedModels}
        tableItems={models}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        trackBy="modelName"
        header={
          <TableHeader
            nrSelectedItems={selectedModels.length}
            nrTotalItems={models.length}
            header={t('models.header')}
            actions={actionButtons}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('models.loading-models')}
        localStorageKey="models-table-preferences"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="models"
      />
    </PageLayout>
  );
};
