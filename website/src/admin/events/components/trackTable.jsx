import { Header, Table } from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLinksButtons } from '../../../components/eventLinksButtons';
import awsconfig from '../../../config.json';
import { useFleetsContext } from '../../../store/storeProvider';

export const TrackTable = ({ eventId, tracks }) => {
  const { t } = useTranslation();
  const [tableItems, setTableItems] = React.useState([]);
  const [, , getFleetNameFromId] = useFleetsContext();

  useEffect(() => {
    setTableItems(
      tracks.map((track, index) => {
        return {
          ...track,
          leaderboardLinks: (
            <EventLinksButtons
              href={`${
                awsconfig.Urls.leaderboardWebsite
              }/leaderboard/${eventId.toString()}/?qr=header&scroll=true&track=${track.trackId.toString()}`}
              linkTextPrimary={t('events.leaderboard-link-same-tab')}
              linkTextExternal={t('events.leaderboard-link-new-tab')}
            />
          ),
        };
      })
    );
  }, [tracks, eventId, t]);

  const columnsConfig = [
    {
      id: 'trackId',
      header: 'Track',
      cell: (item) => item.trackId || '-',
      width: 100,
      minWidth: 100,
    },
    {
      id: 'fleetId',
      header: 'Car fleet',
      cell: (item) => getFleetNameFromId(item.fleetId) || '-',
    },
    {
      id: 'leaderBoardTitle',
      header: 'Header Text',
      cell: (item) => item.leaderBoardTitle || '-',
    },
    {
      id: 'leaderBoardFooter',
      header: 'Footer Text',
      cell: (item) => item.leaderBoardFooter || '-',
    },
    {
      id: 'leaderboardLinks',
      header: 'Leaderboard Links',
      cell: (item) => item.leaderboardLinks || '-',
    },
  ];
  console.info(tableItems);
  return (
    <Table
      header={<Header variant="h3">Leaderboards</Header>}
      columnDefinitions={columnsConfig}
      items={tableItems}
      trackBy="trackId"
      resizableColumns
      variant="embedded"
    />
  );
};
