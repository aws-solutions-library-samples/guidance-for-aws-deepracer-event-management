import { Button, Header, StatusIndicator, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../../support-functions/time';

const LapTable = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState([]);

  const { laps, onAction } = props;

  useEffect(() => {
    if (laps.length) {
      const items = laps.map((lap) => {
        if (lap.isValid) {
        }

        return {
          ...lap,
          lapId: lap.lapId + 1,
          time: convertMsToString(lap.time),

          valid: (
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
      columnDefinitions={[
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
          id: 'resets',
          header: t('timekeeper.lap-table.resets'),
          cell: (item) => item.resets || 0,
          sortingField: 'resets',
        },
        {
          id: 'valid',
          header: t('timekeeper.lap-table.valid'),
          cell: (item) => item.valid || '',
          width: '200px',
        },
      ]}
      items={lapsJsx}
      loadingText={t('timekeeper.lap-table.loading-resources')}
      sortingDisabled
      stripedRows
      header={<Header> {props.header} </Header>}
    />
  );
};

export { LapTable };
