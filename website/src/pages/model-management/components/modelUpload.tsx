import { FileUpload, ProgressBar } from '@cloudscape-design/components';
import { uploadData } from 'aws-amplify/storage';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentAuthUser } from '../../../hooks/useAuth';

import { useStore } from '../../../store/store';

import awsconfig from '../../../config.json';

/** Legacy config shape for accessing the upload bucket name */
interface LegacyConfig {
  Storage?: {
    uploadBucket?: string;
    region?: string;
  };
}

/**
 * ModelUpload component for uploading model files to S3
 * Uses CloudScape FileUpload component with drag and drop support
 */
export function ModelUpload(): JSX.Element {
  const { t } = useTranslation();
  const [sub, setSub] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [, dispatch] = useStore();

  useEffect(() => {
    const getData = async () => {
      getCurrentAuthUser().then((authUser) => {
        setSub(authUser.sub);
        setUsername(authUser.username);
      });
    };

    getData();
  }, []);

  useEffect(() => {
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      saveModel(file);
    }
    setSelectedFiles([]);
  }, [selectedFiles]);

  const saveModel = async (file: File) => {
    const s3path = `${sub}/${username}/models/${file.name}`;

    if (file.name.match(/^[a-zA-Z0-9-_]+\.tar\.gz$/)) {
      const legacyConfig = awsconfig as unknown as LegacyConfig;
      const uploadBucket = legacyConfig.Storage?.uploadBucket;
      const uploadRegion = legacyConfig.Storage?.region;

      const uploadOp = uploadData({
        path: ({identityId}) => `private/${identityId}/${s3path}`,
        data: file,
        options: {
          contentType: file.type,
          onProgress(progress: { transferredBytes: number; totalBytes?: number }) {
            const total = progress.totalBytes || 1;
            dispatch('ADD_NOTIFICATION', {
              type: 'info',
              content: (
                <ProgressBar
                  description={t('models.notifications.uploading-model') + ' ' + file.name + '...'}
                  value={Math.round((progress.transferredBytes / total) * 100)}
                  variant="flash"
                />
              ),
              id: file.name,
              dismissible: true,
              onDismiss: () => {
                dispatch('DISMISS_NOTIFICATION', file.name);
              },
            });
          },
          ...(uploadBucket ? { bucket: { bucketName: uploadBucket, region: uploadRegion || '' } } : {}),
        },
      });

      uploadOp.result
        .then((result: any) => {
          console.debug('MODEL UPLOAD RESULT', result);
          dispatch('ADD_NOTIFICATION', {
            type: 'success',
            content: (
              <ProgressBar
                description={
                  t('models.notifications.upload-successful-1') +
                  ' ' +
                  file.name +
                  ' ' +
                  t('models.notifications.upload-successful-2')
                }
                value={100}
                variant="flash"
              />
            ),
            id: file.name,
            dismissible: true,
            onDismiss: () => {
              dispatch('DISMISS_NOTIFICATION', file.name);
            },
          });
        })
        .catch((err: any) => {
          console.info(err);
          dispatch('ADD_NOTIFICATION', {
            header: t('models.notifications.could-not-upload') + ' ' + file.name,
            type: 'error',
            content: t('common.error'),
            dismissible: true,
            dismissLabel: t('models.notifications.dismiss-message'),
            id: file.name,
            onDismiss: () => {
              dispatch('DISMISS_NOTIFICATION', file.name);
            },
          });
        });
    } else {
      dispatch('ADD_NOTIFICATION', {
        header: t('models.notifications.could-not-upload') + ' ' + file.name,
        type: 'error',
        content: file.name + ' ' + t('carmodelupload.modal.file-regex'),
        dismissible: true,
        dismissLabel: t('models.notifications.dismiss-message'),
        id: file.name,
        onDismiss: () => {
          dispatch('DISMISS_NOTIFICATION', file.name);
        },
      });
    }
  };

  return (
    <FileUpload
      onChange={({ detail }) => setSelectedFiles(detail.value)}
      value={selectedFiles}
      i18nStrings={{
        uploadButtonText: (multiple) => multiple ? t('upload.chose-files') : t('upload.chose-file'),
        dropzoneText: (multiple) => multiple ? t('upload.drop-files') : t('upload.drop-file'),
        removeFileAriaLabel: (fileIndex) => `Remove file ${fileIndex + 1}`,
        limitShowFewer: t('upload.show-fewer'),
        limitShowMore: t('upload.show-more'),
        errorIconAriaLabel: t('common.error'),
      }}
      accept=".tar.gz"
      multiple
      showFileSize
      showFileLastModified
    />
  );
}
