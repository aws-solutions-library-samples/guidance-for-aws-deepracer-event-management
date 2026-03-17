import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from '../../../hooks/useMutation';
import { useStore } from '../../../store/store';
import { Model } from '../../../types/domain';

interface DeleteModelModalProps {
  disabled: boolean;
  selectedModels: Model[];
  onDelete: () => void;
  variant?: 'normal' | 'primary' | 'link' | 'icon';
}

export const DeleteModelModal: React.FC<DeleteModelModalProps> = ({ 
  disabled, 
  selectedModels, 
  onDelete, 
  variant 
}) => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const [send] = useMutation() as any; // TODO: Type useMutation hook properly

  const [visible, setVisible] = useState<boolean>(false);

  const deleteModels = async (): Promise<void> => {
    setVisible(false);
    for (const i in selectedModels) {
      const model = selectedModels[i] as any; // TODO: Align Model interface with actual data structure
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

interface ItemsListProps {
  items: Model[];
}

const ItemsList: React.FC<ItemsListProps> = ({ items }) => {
  return (
    <ul>
      {items.map((item: any) => (
        <li key={item.fileMetaData?.key || item.modelKey}>{item.fileMetaData?.filename || item.modelName}</li>
      ))}
    </ul>
  );
};
