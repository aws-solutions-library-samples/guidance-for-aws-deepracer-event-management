import { Button, ProgressBar } from '@cloudscape-design/components';
import { Auth, Storage } from 'aws-amplify';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/store';
import { formatAwsDateTime } from '../../../support-functions/time';

export function ModelUpload({ addModel }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState();
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [, dispatch] = useStore();

  useEffect(() => {
    const getData = async () => {
      Auth.currentAuthenticatedUser().then((user) => setUsername(user.username));
    };

    getData();

    return () => {
      // Unmounting
    };
  }, []);

  const handleFileUpload = (e) => {
    setUploadFiles(e.target.files);
  };

  useEffect(() => {
    const saveModel = async (file) => {
      const s3path = username + '/models/' + file.name;

      if (file.name.match(/^[a-zA-Z0-9-_]+\.tar\.gz$/)) {
        Storage.put(s3path, file, {
          level: 'private',
          contentType: file.type,
          tagging: 'lifecycle=true',
          progressCallback(progress) {
            dispatch('ADD_NOTIFICATION', {
              type: 'info',
              content: (
                <ProgressBar
                  description={t('models.notifications.uploading-model') + ' ' + file.name + '...'}
                  value={Math.round((progress.loaded / progress.total) * 100)}
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
        })
          .then((result) => {
            console.debug(result);
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
            addModel({
              key: s3path,
              modelDate: formatAwsDateTime(new Date()),
              modelName: file.name,
            });
          })
          .catch((err) => {
            console.debug(err);
            dispatch('ADD_NOTIFICATION', {
              header: t('models.notifications.could-not-upload') + ' ' + file.name,
              type: 'error',
              content: t('common.error'),
              dismissible: true,
              dismissLabel: 'Dismiss message',
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
          content: file.name + ' ' + t('carmodelupload-modal.file-regex'),
          dismissible: true,
          dismissLabel: 'Dismiss message',
          id: file.name,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', file.name);
          },
        });
      }
    };

    for (let index = 0; index < uploadFiles.length; index++) {
      saveModel(uploadFiles[index]);
    }

    return () => {
      // Unmounting
    };
  }, [uploadFiles]);

  return (
    <>
      <Button
        iconName="upload"
        onClick={() => {
          setUploadFiles([]);
          fileInputRef.current.click();
        }}
      >
        {t('upload.chose-file')}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="application/gzip,application/tar"
          multiple
          hidden
        />
      </Button>
    </>
  );
}
