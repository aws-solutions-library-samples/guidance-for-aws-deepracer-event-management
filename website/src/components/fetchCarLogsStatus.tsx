import { StatusIndicator } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

/**
 * Valid car logs fetch status values
 */
type CarLogsStatusType = 
  | 'CREATED' 
  | 'REQUESTED_UPLOAD' 
  | 'WAITING_FOR_UPLOAD' 
  | 'UPLOAD_FAILED' 
  | 'UPLOADED' 
  | 'ANALYZED' 
  | 'PROCESSING' 
  | 'DONE' 
  | 'FAILED';

/**
 * Props interface for FetchCarLogsStatus component
 */
interface FetchCarLogsStatusProps {
  /** Current status of the car logs fetch operation */
  status: CarLogsStatusType | string;
}

/**
 * FetchCarLogsStatus component that displays a status indicator for car logs operations
 * @param props - Component props
 * @returns Rendered status indicator or '-' for unknown status
 */
export const FetchCarLogsStatus = ({ status }: FetchCarLogsStatusProps): JSX.Element | string => {
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
