import { StatusIndicator } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

export const ModelUploadStatus = ({ status }) => {
  const { t } = useTranslation();

  if (status === 'UPLOADED')
    return <StatusIndicator type="pending">{t('model.upload.status.uploaded')}</StatusIndicator>;
  else if (status === 'AVAILABLE')
    return <StatusIndicator type="success">{t('model.upload.status.available')}</StatusIndicator>;
  else if (status === 'QUARANTINED')
    return <StatusIndicator type="warning">{t('model.upload.status.quarantined')}</StatusIndicator>;
  else if (status === 'NOT_VALID')
    return <StatusIndicator type="error">{t('model.upload.status.not-valid')}</StatusIndicator>;
  else if (status === 'OPTIMIZED')
    return <StatusIndicator type="success">{t('model.upload.status.optimized')}</StatusIndicator>;    
  else return '-';
};
