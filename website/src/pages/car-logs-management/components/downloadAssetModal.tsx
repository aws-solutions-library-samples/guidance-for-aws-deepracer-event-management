import { Box, Button, ButtonProps, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useQuery from '../../../hooks/useQuery';
import { useStore } from '../../../store/store';

/**
 * Asset metadata structure
 */
interface AssetMetadata {
  filename: string;
  key: string;
}

/**
 * Asset structure with download information
 */
interface Asset {
  assetId: string;
  sub: string;
  assetMetaData: AssetMetadata;
}

/**
 * Download link response structure
 */
interface DownloadLinkResponse {
  downloadLink: string;
}

/**
 * Props for DownloadAssetModal component
 */
interface DownloadAssetModalProps {
  /** Whether the download button is disabled */
  disabled?: boolean;
  /** List of selected assets to download */
  selectedAssets: Asset[];
  /** Callback function triggered after successful download */
  onDownload: () => void;
  /** Button variant style */
  variant?: ButtonProps.Variant;
}

export const DownloadAssetModal = ({
  disabled,
  selectedAssets,
  onDownload,
  variant,
}: DownloadAssetModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();

  const [visible, setVisible] = useState(false);
  const [triggerCall, setTriggerCall] = useState(false);
  const [triggerDownload, setTriggerDownload] = useState(false);

  const assetSubPairs = selectedAssets.map((asset) => {
    return { assetId: asset.assetId, sub: asset.sub };
  });

  // Note: Using type assertion because this query name isn't defined in the queries file
  // This will fail at runtime if the query doesn't exist
  const [data, loading] = useQuery<DownloadLinkResponse[]>(
    (triggerCall ? 'getCarLogsAssetsDownloadLinks' : null) as any,
    {
      assetSubPairs: assetSubPairs,
    }
  );

  useEffect(() => {
    if (visible) {
      setTriggerCall(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!loading && triggerDownload && data) {
      const downloadFile = (index: number, url: string, filename: string) => {
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

/**
 * Props for ItemsList component
 */
interface ItemsListProps {
  /** Array of assets to display */
  items: Asset[];
}

/**
 * ItemsList component that renders a list of asset filenames
 * @param props - Component props
 * @returns Unordered list of asset filenames
 */
const ItemsList = ({ items }: ItemsListProps): JSX.Element => {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.assetMetaData.key}>{item.assetMetaData.filename}</li>
      ))}
    </ul>
  );
};
