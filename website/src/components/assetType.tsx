import { useTranslation } from 'react-i18next';

/**
 * Valid asset type values
 */
type AssetType = 'VIDEO' | 'BAG_SQLITE' | 'BAG_MCAP';

/**
 * Props interface for CarLogsAssetType component
 */
interface CarLogsAssetTypeProps {
  /** Type of the car logs asset */
  type: AssetType | string;
}

/**
 * CarLogsAssetType component that displays a localized asset type label
 * @param props - Component props
 * @returns Localized asset type string
 */
export const CarLogsAssetType = ({ type }: CarLogsAssetTypeProps): string => {
  const { t } = useTranslation();

  if (type === 'VIDEO') return t('carlogs.assets.types.video');
  else if (type === 'BAG_SQLITE') return t('carlogs.assets.types.bag_sqlite');
  else if (type === 'BAG_MCAP') return t('carlogs.assets.types.bag_mcap');
  else return '-';
};
