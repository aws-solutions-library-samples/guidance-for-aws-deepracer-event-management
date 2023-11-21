import { Header, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../../support-functions/time';

const FastestAverageLapTable = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState([]);

  const { fastestAverageLap } = props;

  //lap.current = [...fastestAverageLap];

  useEffect(() => {
    if (fastestAverageLap && fastestAverageLap.length > 0) {
      SetLapsJsx([...fastestAverageLap]);
    } else {
      SetLapsJsx([]);
    }
  }, [fastestAverageLap]);

  return (
    <Table
      display="none"
      variant="embedded"
      columnDefinitions={[
        {
          id: 'fromLap',
          header: t('timekeeper.avg-lap-table.from-lap'),
          cell: (item) => item.startLapId + 1 || '',
          width: '100px',
        },
        {
          id: 'toLap',
          header: t('timekeeper.avg-lap-table.to-lap'),
          cell: (item) => item.endLapId + 1 || '',
          width: '100px',
        },
        {
          id: 'average',
          header: t('timekeeper.avg-lap-table.average'),
          cell: (item) => convertMsToString(item.avgTime) || 0,
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
