import { Button, Header, Table } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LapTable = (props) => {
  const { t } = useTranslation();
  const [lapsJsx, SetLapsJsx] = useState([]);

  const { laps, onAction } = props;

  useEffect(() => {
    if (laps.length) {
      const items = laps.map((lap) => {
        // console.info(lap);
        return {
          ...lap,
          id: lap.id + 1,
          time: convertMsToString(lap.time),
          actions: (
            <Button onClick={() => onAction(lap.id)}>
              {(lap.isValid && <span>DQ</span>) || <span>Allow</span>}
            </Button>
          ),
        };
      });
      SetLapsJsx(items.reverse());
    } else {
      SetLapsJsx([]);
    }
  }, [laps, onAction]);

  const convertMsToString = (timeInMS) => {
    const millisecondsAsString = String(timeInMS).slice(-3).padStart(3, '0');
    const seconds = Math.floor(timeInMS / 1000);
    const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    return `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
  };

  return (
    <Table
      columnDefinitions={[
        {
          id: 'id',
          header: t('timekeeper.laptable.lap-number'),
          cell: (item) => item.id || '',
          sortingField: 'id',
          width: '100px',
        },
        {
          id: 'time',
          header: t('timekeeper.laptable.lap-time'),
          cell: (item) => item.time || '',
          sortingField: 'time',
        },
        {
          id: 'resets',
          header: t('timekeeper.laptable.resets'),
          cell: (item) => item.resets || 0,
          sortingField: 'resets',
        },
        {
          id: 'actions',
          header: t('timekeeper.laptable.actions'),
          cell: (item) => item.actions || '',
          width: '200px',
        },
      ]}
      items={lapsJsx}
      loadingText={t('timekeeper.laptable.loading-reources')}
      sortingDisabled
      header={<Header> {props.header} </Header>}
    />
  );
};

export { LapTable };
