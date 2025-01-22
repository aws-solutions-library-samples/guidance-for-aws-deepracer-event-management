import { StatusIndicator } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

export const FetchCarLogsStatus = ({ status }) => {
  const { t } = useTranslation();

  if (status === 'CREATED')
    return <StatusIndicator type="pending">{t('carlogs.upload.status.created')}</StatusIndicator>;
  else if (status === 'REQUESTED_UPLOAD')
    return (
      <StatusIndicator type="pending">
        {t('carlogs.upload.status.requested_upload')}
      </StatusIndicator>
    );
  else if (status === 'WAITING_FOR_UPLOAD')
    return (
      <StatusIndicator type="in-progress">
        {t('carlogs.upload.status.waiting_for_upload')}
      </StatusIndicator>
    );
  else if (status === 'UPLOAD_FAILED')
    return (
      <StatusIndicator type="error">{t('carlogs.upload.status.upload_failed')}</StatusIndicator>
    );
  else if (status === 'UPLOADED')
    return (
      <StatusIndicator type="in-progress">{t('carlogs.upload.status.uploaded')}</StatusIndicator>
    );
  else if (status === 'ANALYZED')
    return (
      <StatusIndicator type="in-progress">{t('carlogs.upload.status.analyzed')}</StatusIndicator>
    );
  else if (status === 'PROCESSING')
    return (
      <StatusIndicator type="in-progress">{t('carlogs.upload.status.processing')}</StatusIndicator>
    );
  else if (status === 'DONE')
    return <StatusIndicator type="success">{t('carlogs.upload.status.done')}</StatusIndicator>;
  else if (status === 'FAILED')
    return <StatusIndicator type="error">{t('carlogs.upload.status.failed')}</StatusIndicator>;
  else return '-';
};
