import { useTranslation } from 'react-i18next';

export const CarLogsAssetType = ({ type }) => {
  const { t } = useTranslation();

  if (type === 'VIDEO') return t('carlogs.assets.types.video');
  else if (type === 'BAG_SQLITE') return t('carlogs.assets.types.bag_sqlite');
  else if (type === 'BAG_MCAP') return t('carlogs.assets.types.bag_mcap');
  else return '-';
};
