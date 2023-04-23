import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import { Storage } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationsDispatch } from '../../../store/appLayoutProvider';

export const DeleteModelModal = ({ disabled, selectedModels, removeModel, variant }) => {
  const { t } = useTranslation();
  const [addNotification, dismissNotification] = useNotificationsDispatch();

  const [visible, setVisible] = useState(false);

  const deleteModels = async () => {
    setVisible(false);
    for (const i in selectedModels) {
      const model = selectedModels[i];
      addNotification({
        header: `Model ${model.modelName} is being deleted...`,
        type: 'info',
        loading: true,
        dismissible: true,
        dismissLabel: 'Dismiss message',
        id: model.key,
        onDismiss: () => {
          dismissNotification(model.key);
        },
      });

      Storage.remove(model.key, { level: 'private' })
        .then((response) => {
          console.info(response);
          addNotification({
            header: `Model ${model.modelName} has been deleted`,
            type: 'success',
            dismissible: true,
            dismissLabel: 'Dismiss message',
            id: model.key,
            onDismiss: () => {
              dismissNotification(model.key);
            },
          });

          removeModel(model.key);
        })
        .catch((error) => {
          console.info(error);
          addNotification({
            header: `Model ${model.modelName} could not be deleted`,
            type: 'error',
            dismissible: true,
            dismissLabel: 'Dismiss message',
            id: model.key,
            onDismiss: () => {
              dismissNotification(model.key);
            },
          });
        });
    }
  };

  return (
    <>
      <Button
        disabled={disabled}
        variant={variant}
        onClick={() => {
          setVisible(true);
        }}
      >
        {selectedModels.length > 1 ? t('models.delete-models') : t('models.delete-model')}
      </Button>

      <Modal
        onDismiss={() => setVisible(false)}
        visible={visible}
        closeAriaLabel="Close Modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setVisible(false)}>{t('button.cancel')}</Button>
              <Button variant="primary" onClick={() => deleteModels()}>
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('models.delete-modal.header')}
      >
        {t('models.delete-modal.description')}
        <ItemsList items={selectedModels} />
      </Modal>
    </>
  );
};

const ItemsList = ({ items }) => {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.key}>{item.modelName}</li>
      ))}
    </ul>
  );
};
