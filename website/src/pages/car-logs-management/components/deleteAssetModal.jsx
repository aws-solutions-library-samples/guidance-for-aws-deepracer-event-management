import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMutation from '../../../hooks/useMutation';

export const DeleteAssetModal = ({ disabled, selectedAssets, onDelete, variant }) => {
  const { t } = useTranslation();
  const [send] = useMutation();

  const [visible, setVisible] = useState(false);

  const deleteAssets = async () => {
    setVisible(false);
    for (const i in selectedAssets) {
      const asset = selectedAssets[i];
      console.info('DELETE_ASSET', asset);
      send('deleteCarLogsAsset', { assetId: asset.assetId, sub: asset.sub });
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
        {selectedAssets.length > 1
          ? t('carlogs.assets.delete-assets')
          : t('carlogs.assets.delete-asset')}
      </Button>

      <Modal
        onDismiss={() => setVisible(false)}
        visible={visible}
        closeAriaLabel={t('carlogs.assets.close-modal-ari-label')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setVisible(false)}>{t('button.cancel')}</Button>
              <Button variant="primary" onClick={() => deleteAssets()}>
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carlogs.assets.delete-modal.header')}
      >
        {t('carlogs.assets.delete-modal.description')}
        <ItemsList items={selectedAssets} />
      </Modal>
    </>
  );
};

const ItemsList = ({ items }) => {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.assetMetaData.key}>{item.assetMetaData.filename}</li>
      ))}
    </ul>
  );
};
