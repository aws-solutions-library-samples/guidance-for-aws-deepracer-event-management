import { Header, Table, TableProps } from '@cloudscape-design/components';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from '../../../types/domain';
import { EventLinksButtons } from '../../../components/eventLinksButtons';
import awsconfig from '../../../config.json';

/**
 * Extended config type to include Urls (merged at runtime)
 */
interface Config {
  Urls: {
    leaderboardWebsite: string;
    streamingOverlayWebsite: string;
    [key: string]: string;
  };
  [key: string]: any;
}

const config = awsconfig as unknown as Config;

/**
 * Extended track item with link components for table display
 */
interface TrackTableItem extends Track {
  leaderboardLinks: React.ReactNode;
  streamingOverlayLinks: React.ReactNode;
  streamingOverlayChromaLinks: React.ReactNode;
}

/**
 * Props for TrackTable component
 */
interface TrackTableProps {
  eventId: string;
  tracks: Track[];
  raceFormat: string;
}

export const TrackTable: React.FC<TrackTableProps> = ({ eventId, tracks, raceFormat }) => {
  const { t } = useTranslation();
  const [tableItems, setTableItems] = React.useState<TrackTableItem[]>([]);

  useEffect(() => {
    setTableItems(
      tracks.map((track) => {
        return {
          ...track,
          leaderboardLinks: (
            <EventLinksButtons
              href={`${
                config.Urls.leaderboardWebsite
              }/leaderboard/${eventId.toString()}/?qr=header&scroll=true&track=${track.trackId.toString()}&format=${raceFormat}`}
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
          streamingOverlayLinks: (
            <EventLinksButtons
              href={`${
                config.Urls.streamingOverlayWebsite
              }/${eventId.toString()}?trackId=${track.trackId.toString()}&format=${raceFormat}`}
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
          streamingOverlayChromaLinks: (
            <EventLinksButtons
              href={`${
                config.Urls.streamingOverlayWebsite
              }/${eventId.toString()}?trackId=${track.trackId.toString()}&chroma=1&format=${raceFormat}`}
              linkTextPrimary={t('events.link-same-tab')}
              linkTextExternal={t('events.link-new-tab')}
            />
          ),
        };
      })
    );
  }, [tracks, eventId, t, raceFormat]);

  const columnsConfig: TableProps.ColumnDefinition<TrackTableItem>[] = [
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
