import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from '../../../hooks/useMutation';
import { useStore } from '../../../store/store';

export const DeleteModelModal = ({ disabled, selectedModels, onDelete, variant }) => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const [send] = useMutation();

  const [visible, setVisible] = useState(false);

  const deleteModels = async () => {
    setVisible(false);
    for (const i in selectedModels) {
      const model = selectedModels[i];
      console.info('model', model);
      send('deleteModel', { modelId: model.modelId, sub: model.sub, modelname: model.modelname });
      onDelete();
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
        closeAriaLabel={t('carmodelupload.close-modal-ari-label')}
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
        <li key={item.fileMetaData.key}>{item.fileMetaData.filename}</li>
      ))}
    </ul>
  );
};
