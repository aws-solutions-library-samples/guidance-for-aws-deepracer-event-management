import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useQuery from '../../../hooks/useQuery';
import { useStore } from '../../../store/store';

export const DownloadAssetModal = ({ disabled, selectedAssets, onDownload, variant }) => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();

  const [visible, setVisible] = useState(false);
  const [triggerCall, setTriggerCall] = useState(false);
  const [triggerDownload, setTriggerDownload] = useState(false);

  const assetSubPairs = selectedAssets.map((asset) => {
    return { assetId: asset.assetId, sub: asset.sub };
  });

  const [data, loading] = useQuery(triggerCall ? 'getCarLogsAssetsDownloadLinks' : null, {
    assetSubPairs: assetSubPairs,
  });

  useEffect(() => {
    if (visible) {
      setTriggerCall(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!loading && triggerDownload && data) {
      const downloadFile = (index, url, filename) => {
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              dispatch('DISMISS_NOTIFICATION', `getCarLogsAssetsDownloadLinks-${index}`);
              dispatch('ADD_NOTIFICATION', {
                content: t('carlogs.assets.notifications.download-failed') + ' ' + filename,
                type: 'error',
                dismissible: true,
                dismissLabel: t('carlogs.assets.notifications.dismiss-message'),
                id: `getCarLogsAssetsDownloadLinks-${index}`,
                onDismiss: () => {
                  dispatch('DISMISS_NOTIFICATION', `getCarLogsAssetsDownloadLinks-${index}`);
                },
              });
              if (response.status === 404) {
                throw new Error('File not found');
              } else {
                throw new Error('An error occurred while downloading the file');
              }
            }
            return response.blob();
          })
          .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a); // Clean up the DOM
            dispatch('DISMISS_NOTIFICATION', `getCarLogsAssetsDownloadLinks-${index}`);
            dispatch('ADD_NOTIFICATION', {
              content: t('carlogs.assets.notifications.download-successful') + ' ' + filename,
              type: 'success',
              dismissible: true,
              dismissLabel: t('carlogs.assets.notifications.dismiss-message'),
              id: `getCarLogsAssetsDownloadLinks-${index}`,
              onDismiss: () => {
                dispatch('DISMISS_NOTIFICATION', `getCarLogsAssetsDownloadLinks-${index}`);
              },
            });
          })
          .catch((error) => console.error('Error downloading file:', error));
      };

      setTriggerDownload(false);
      setVisible(false);
      onDownload();

      data.forEach((asset, index) => {
        const filename = selectedAssets[index].assetMetaData.filename;

        dispatch('ADD_NOTIFICATION', {
          content: t('carlogs.assets.notifications.downloading') + ' ' + filename,
          type: 'info',
          dismissible: true,
          dismissLabel: t('carlogs.assets.notifications.dismiss-message'),
          id: `getCarLogsAssetsDownloadLinks-${index}`,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', `getCarLogsAssetsDownloadLinks-${index}`);
          },
        });

        downloadFile(index, asset.downloadLink, filename);
      });
    }
  }, [loading, triggerDownload, data, selectedAssets, onDownload, dispatch, t]);

  useEffect(() => {
    if (triggerCall) {
      setTriggerCall(false);
    }
  }, [triggerCall]);

  const downloadAssets = () => {
    setTriggerDownload(true);
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
          ? t('carlogs.assets.download-assets')
          : t('carlogs.assets.download-asset')}
      </Button>

      <Modal
        onDismiss={() => setVisible(false)}
        visible={visible}
        closeAriaLabel={t('carlogs.assets.close-modal-ari-label')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setVisible(false)}>{t('button.cancel')}</Button>
              <Button variant="primary" disabled={loading} onClick={() => downloadAssets()}>
                {t('button.download')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carlogs.assets.download-modal.header')}
      >
        {t('carlogs.assets.download-modal.description')}
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
