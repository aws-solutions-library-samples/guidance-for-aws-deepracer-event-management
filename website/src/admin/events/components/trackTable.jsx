import { Header, Table } from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLinksButtons } from '../../../components/eventLinksButtons';
import awsconfig from '../../../config.json';

export const TrackTable = ({ eventId, tracks }) => {
  const { t } = useTranslation();
  const [tableItems, setTableItems] = React.useState([]);

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
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
          streamingOverlayLinks: (
            <EventLinksButtons
              href={`${
                awsconfig.Urls.streamingOverlayWebsite
              }/${eventId.toString()}?trackId=${track.trackId.toString()}`}
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
          streamingOverlayChromaLinks: (
            <EventLinksButtons
              href={`${
                awsconfig.Urls.streamingOverlayWebsite
              }/${eventId.toString()}?trackId=${track.trackId.toString()}&chroma=1`}
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
        };
      })
    );
  }, [tracks, eventId, t]);

  const columnsConfig = [
    {
      id: 'trackId',
      header: t('events.track-type'),
      cell: (item) => item.trackId || '-',
      width: 100,
      minWidth: 100,
    },
    {
      id: 'fleetId',
      header: t('events.car-fleet'),
      cell: (item) => item.fleetId || '-',
    },
    {
      id: 'leaderBoardTitle',
      header: t('events.leaderboard.header'),
      cell: (item) => item.leaderBoardTitle || '-',
    },
    {
      id: 'leaderBoardFooter',
      header: t('events.leaderboard.footer'),
      cell: (item) => item.leaderBoardFooter || '-',
    },
    {
      id: 'leaderboardLinks',
      header: t('events.leaderboard.links'),
      cell: (item) => item.leaderboardLinks || '-',
    },
    {
      id: 'streamingOverlayLinks',
      header: t('events.streaming-overlay-link'),
      cell: (item) => item.streamingOverlayLinks || '-',
    },
    {
      id: 'streamingOverlayChromaLinks',
      header: t('events.streaming-overlay-link-chroma'),
      cell: (item) => item.streamingOverlayChromaLinks || '-',
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
