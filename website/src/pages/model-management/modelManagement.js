import { Auth, Storage } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import DeleteModelModal from './components/deleteModelModal';
import { ModelsTable } from './components/modelsTable';

import { SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';

import { formatAwsDateTime } from '../../support-functions/time';
import { ModelUpload } from './components/modelUpload';

export const ModelMangement = () => {
  const { t } = useTranslation();

  const [allItems, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
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
              setItems(userModels);
              setIsLoading(false);
            }
          });
        })
        .catch((err) => {
          console.log(err);
        });
    };

    getData();

    return () => {
      // Unmounting
    };
  }, []);

  const removeItem = (key) => {
    setItems((items) => items.filter((items) => items.key !== key));
    setSelectedItems((items) => items.filter((items) => items.key !== key));
  };

  const actionButtons = (
    <SpaceBetween direction="horizontal" size="xs">
      <ModelUpload />
      <DeleteModelModal
        disabled={selectedItems.length === 0}
        selectedItems={selectedItems}
        removeItem={removeItem}
        variant="primary"
      />
    </SpaceBetween>
  );

  return (
    <PageLayout
      header={t('models.header')}
      //description={t('models.list-of-your-uploaded-models')}
      breadcrumbs={[{ text: t('home.breadcrumb'), href: '/' }, { text: t('models.breadcrumb') }]}
    >
      <ModelsTable
        isLoading={isLoading}
        models={allItems}
        setSelectedModels={setSelectedItems}
        selectedModels={selectedItems}
        actionButtons={actionButtons}
      />
    </PageLayout>
  );
};
