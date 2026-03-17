import { Button, Header, StatusIndicator, Table, TableProps } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../../../admin/events/support-functions/raceConfig';
import { convertMsToString } from '../../../support-functions/time';

interface Lap {
  lapId: number;
  time: number;
  isValid: boolean;
  resets?: number;
  carName?: string;
}

interface AverageLapInfo {
  endLapId: string | number;
  avgTime: number;
}

interface LapTableItem {
  lapId: number;
  time: string;
  average?: string;
  resets?: number;
  valid: JSX.Element;
  carName?: string;
}

interface LapTableProps {
  laps: Lap[];
  onAction?: (lapId: number) => void;
  averageLapInformation?: AverageLapInfo[];
  rankingMethod: string;
  readonly?: boolean;
  variant?: TableProps.Variant;
  header?: string;
}

const LapTable: React.FC<LapTableProps> = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState<LapTableItem[]>([]);

  const { laps, onAction, averageLapInformation, rankingMethod, readonly = false } = props;

  const columnDefinitions = [
    {
      id: 'id',
      header: t('timekeeper.lap-table.lap-number'),
      cell: (item: LapTableItem) => item.lapId || '',
      sortingField: 'id',
      width: '100px',
    },
    {
      id: 'time',
      header: t('timekeeper.lap-table.lap-time'),
      cell: (item: LapTableItem) => item.time || '',
      sortingField: 'time',
    },
    {
      id: 'average',
      header: t('timekeeper.lap-table.average'),
      cell: (item: LapTableItem) => item.average || '',
      sortingField: 'average',
    },
    {
      id: 'resets',
      header: t('timekeeper.lap-table.resets'),
      cell: (item: LapTableItem) => item.resets || 0,
      sortingField: 'resets',
    },
    {
      id: 'valid',
      header: t('timekeeper.lap-table.valid-header'),
      cell: (item: LapTableItem) => item.valid || '',
      width: '200px',
    },
    {
      id: 'car',
      header: t('timekeeper.lap-table.lap-car'),
      cell: (item: LapTableItem) => item.carName || '',
    },
  ];

  if (rankingMethod !== RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    columnDefinitions.splice(2, 1);
  }

  useEffect(() => {
    if (laps && laps.length) {
      const items: LapTableItem[] = laps.map((lap) => {
        if (lap.isValid) {
        }

        let averageLap: AverageLapInfo | undefined;
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
              <Button onClick={() => onAction && onAction(lap.lapId)}>
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
  }, [laps, onAction, readonly, t, averageLapInformation]);

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
