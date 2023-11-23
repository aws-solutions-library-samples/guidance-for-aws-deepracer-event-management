import { Button, Header, StatusIndicator, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../../../admin/events/support-functions/raceConfig';
import { convertMsToString } from '../../../support-functions/time';

const LapTable = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState([]);

  const { laps, onAction, averageLapInformation, rankingMethod, readonly = false } = props;

  const columnDefinitions = [
    {
      id: 'id',
      header: t('timekeeper.lap-table.lap-number'),
      cell: (item) => item.lapId || '',
      sortingField: 'id',
      width: '100px',
    },
    {
      id: 'time',
      header: t('timekeeper.lap-table.lap-time'),
      cell: (item) => item.time || '',
      sortingField: 'time',
    },
    {
      id: 'average',
      header: t('timekeeper.lap-table.average'),
      cell: (item) => item.average || '',
      sortingField: 'average',
    },
    {
      id: 'resets',
      header: t('timekeeper.lap-table.resets'),
      cell: (item) => item.resets || 0,
      sortingField: 'resets',
    },
    {
      id: 'valid',
      header: t('timekeeper.lap-table.valid-header'),
      cell: (item) => item.valid || '',
      width: '200px',
    },
  ];

  if (rankingMethod !== RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    columnDefinitions.splice(2, 1);
  }

  useEffect(() => {
    if (laps && laps.length) {
      const items = laps.map((lap) => {
        if (lap.isValid) {
        }

        let averageLap;
        if (averageLapInformation) {
          averageLap = averageLapInformation.find(
            (avg) => Number(avg.endLapId) === Number(lap.lapId)
          );
        }
        return {
          ...lap,
          lapId: Number(lap.lapId) + 1,
          time: convertMsToString(lap.time),
          average: averageLap ? convertMsToString(averageLap.avgTime) : undefined,
          valid: readonly ? (
            <StatusIndicator type={lap.isValid ? 'success' : 'error'}>
              {lap.isValid ? t('timekeeper.lap-table.valid') : t('timekeeper.lap-table.not-valid')}
            </StatusIndicator>
          ) : (
            <>
              <Button onClick={() => onAction(lap.lapId)}>
                <StatusIndicator type={lap.isValid ? 'success' : 'error'}>
                  {lap.isValid
                    ? t('timekeeper.lap-table.valid')
                    : t('timekeeper.lap-table.not-valid')}
                </StatusIndicator>
              </Button>
            </>
          ),
        };
      });
      SetLapsJsx(items.reverse());
    } else {
      SetLapsJsx([]);
    }
  }, [laps, onAction]);

  return (
    <Table
      variant={props.variant}
      columnDefinitions={columnDefinitions}
      items={lapsJsx}
      loadingText={t('timekeeper.lap-table.loading-resources')}
      sortingDisabled
      stripedRows
      header={<Header> {props.header} </Header>}
    />
  );
};

export { LapTable };
