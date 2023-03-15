import i18next from '../../i18n';
import {
  GetRaceResetsNameFromId,
  GetRaceTypeNameFromId,
  GetTrackTypeNameFromId,
} from './raceConfig';
import awsconfig from '../../config.json';
import { EventLinksButtons } from '../../components/eventLinksButtons';

export const VisibleContentOptions = () => {
  return [
    {
      label: i18next.t('events.events-information'),
      options: [
        {
          id: 'eventName',
          label: i18next.t('events.event-name'),
          editable: false,
        },
        {
          id: 'eventDate',
          label: i18next.t('events.event-date'),
        },
        {
          id: 'trackType',
          label: i18next.t('events.track-type'),
        },
        {
          id: 'rankingMethod',
          label: i18next.t('events.race.ranking-method'),
        },
        {
          id: 'raceTimeinMin',
          label: i18next.t('events.race.race-time'),
        },
        {
          id: 'raceNumberOfResets',
          label: i18next.t('events.race.resets-per-lap'),
        },
        {
          id: 'carFleet',
          label: i18next.t('events.car-fleet'),
        },
        {
          id: 'country',
          label: i18next.t('events.country'),
        },
        {
          id: 'createdAt',
          label: i18next.t('events.created-at'),
        },
        {
          id: 'eventId',
          label: i18next.t('events.event-id'),
        },
        {
          id: 'eventLeaderboardLink',
          label: i18next.t('events.leaderboard-link'),
        },
        {
          id: 'eventStreamingOverlayLink',
          label: i18next.t('events.streaming-overlay-link'),
        },
      ],
    },
  ];
};

export const ColumnDefinitions = (allCarFleets = undefined) => {
  return [
    {
      id: 'eventName',
      header: i18next.t('events.event-name'),
      cell: (item) => item.eventName || '-',
      sortingField: 'eventName',
    },
    {
      id: 'eventDate',
      header: i18next.t('events.event-date'),
      cell: (item) => item.eventDate || '-',
      sortingField: 'eventDate',
    },
    {
      id: 'carFleet',
      header: i18next.t('events.car-fleet'),
      cell: (item) => {
        if (allCarFleets) {
          const currentFleet = allCarFleets.find((fleet) => fleet.fleetId === item.fleetId);
          if (currentFleet) {
            return currentFleet.fleetName;
          }
        }
        return '-';
      },
      sortingField: 'fleet',
    },
    {
      id: 'trackType',
      header: i18next.t('events.track-type'),
      cell: (item) => GetTrackTypeNameFromId(item.raceTrackType) || '-',
      sortingField: 'trackType',
    },
    {
      id: 'rankingMethod',
      header: i18next.t('events.race.ranking-method'),
      cell: (item) => GetRaceTypeNameFromId(item.raceRankingMethod) || '-',
      sortingField: 'rankingMethod',
    },
    {
      id: 'raceTimeInMin',
      header: i18next.t('events.race.race-time'),
      cell: (item) => item.raceTimeInMin || '-',
      sortingField: 'raceTimeInMin',
    },
    {
      id: 'raceNumberOfResets',
      header: i18next.t('events.race.resets-per-lap'),
      cell: (item) => GetRaceResetsNameFromId(item.raceNumberOfResets) || '-',
      sortingField: 'raceNumberOfResets',
    },
    {
      id: 'country',
      header: i18next.t('events.country'),
      cell: (item) => item.countryCode || '-',
      sortingField: 'country',
    },
    {
      id: 'createdAt',
      header: i18next.t('events.created-at'),
      cell: (item) => item.createdAt || '-',
      sortingField: 'createdAt',
    },
    {
      id: 'eventId',
      header: i18next.t('events.event-id'),
      cell: (item) => item.eventId || '-',
    },
    {
      id: 'eventLeaderboardLink',
      header: i18next.t('events.leaderboard-link'),
      cell: (item) =>
        (
          <EventLinksButtons
            href={awsconfig.Urls.leaderboardWebsite + '/?' + 'event=' + item.eventId.toString()}
            linkTextPrimary={i18next.t('events.leaderboard-link-same-tab')}
            linkTextExternal={i18next.t('events.leaderboard-link-new-tab')}
          />
        ) || '-',
    },
    {
      id: 'eventStreamingOverlayLink',
      header: i18next.t('events.streaming-overlay-link'),
      cell: (item) =>
        (
          <EventLinksButtons
            href={
              awsconfig.Urls.streamingOverlayWebsite + '/?' + 'event=' + item.eventId.toString()
            }
            linkTextPrimary={i18next.t('events.streaming-overlay-link-same-tab')}
            linkTextExternal={i18next.t('events.streaming-overlay-link-new-tab')}
          />
        ) || '-',
    },
  ];
};
