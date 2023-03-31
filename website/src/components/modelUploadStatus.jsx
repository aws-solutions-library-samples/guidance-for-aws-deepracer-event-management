import { Container, ProgressBar, StatusIndicator } from '@cloudscape-design/components';
import { Storage } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ModelUploadStatus(props) {
  const { t } = useTranslation();
  const file = props.file;
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState('Pending');
  const [statusIcon, setStatusIcon] = useState('pending');

  const s3path = props.username + '/models/' + file.name;

  // TODO - switch to flashbar with progres bar
  // https://cloudscape.design/components/flashbar/?tabId=playground&example=with-a-progress-bar

  useEffect(() => {
    const saveModel = async () => {
      if (file.name.match(/^[a-zA-Z0-9-_]+\.tar\.gz$/)) {
        Storage.put(s3path, file, {
          level: 'private',
          contentType: file.type,
          tagging: 'lifecycle=true',
          progressCallback(progress) {
            setStatus(t('common.in-progress'));
            setPercent(Math.round((progress.loaded / progress.total) * 100));
          },
        })
          .then((result) => {
            console.log(result);
            setStatus(t('common.success'));
            setStatusIcon('success');
          })
          .catch((err) => {
            console.log(err);
            setStatus(t('common.error'));
            setStatusIcon('error');
          });
      } else {
        setStatus(file.name + ' ' + t('carmodelupload-modal.file-regex'));
        setStatusIcon('error');
      }
    };

    saveModel();

    return () => {
      // Unmounting
    };
  }, [file, s3path, t]);

  return (
    <React.Fragment key={file.name}>
      <Container textAlign="center">
        <ProgressBar value={percent} />
        <StatusIndicator type={statusIcon}>{status}</StatusIndicator>
        <div>{file.name}</div>
        <div>{(file.size / 1024 / 1024).toFixed(2)} Mb</div>
      </Container>
    </React.Fragment>
  );
}
