import { useTranslation } from 'react-i18next';

export const CarLogsAssetType = ({ type }) => {
  const { t } = useTranslation();

  if (type === 'VIDEO') return t('carlogs.assets.types.video');
  else if (type === 'BAG_SQLITE') return t('carlogs.assets.types.bag_sqlite');
  else return '-';
};
