import { Header, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../../support-functions/time';

/**
 * Represents an average lap time window
 */
interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

interface FastestAverageLapTableProps {
  fastestAverageLap?: AverageLap[];
}

const FastestAverageLapTable: React.FC<FastestAverageLapTableProps> = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState<AverageLap[]>([]);

  const { fastestAverageLap } = props;

  useEffect(() => {
    if (fastestAverageLap && fastestAverageLap.length > 0) {
      SetLapsJsx([...fastestAverageLap]);
    } else {
      SetLapsJsx([]);
    }
  }, [fastestAverageLap]);

  return (
    <Table<AverageLap>
      variant="embedded"
      columnDefinitions={[
        {
          id: 'fromLap',
          header: t('timekeeper.avg-lap-table.from-lap'),
          cell: (item: AverageLap) => item.startLapId + 1 || '',
          width: '100px',
        },
        {
          id: 'toLap',
          header: t('timekeeper.avg-lap-table.to-lap'),
          cell: (item: AverageLap) => item.endLapId + 1 || '',
          width: '100px',
        },
        {
          id: 'average',
          header: t('timekeeper.avg-lap-table.average'),
          cell: (item: AverageLap) => convertMsToString(item.avgTime) || 0,
          width: '100px',
        },
      ]}
      items={lapsJsx}
      loadingText={t('timekeeper.avg-lap-table.loading-resources')}
      sortingDisabled
      stripedRows
      header={<Header> {t('timekeeper.avg-lap-table.header')} </Header>}
    />
  );
};

export { FastestAverageLapTable };
