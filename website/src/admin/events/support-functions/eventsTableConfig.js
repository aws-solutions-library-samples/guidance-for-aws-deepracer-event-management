import { EventLinksButtons } from '../../../components/eventLinksButtons';
import { Flag } from '../../../components/flag';
import awsconfig from '../../../config.json';
import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';
import {
  GetRaceResetsNameFromId,
  GetRaceTypeNameFromId,
  GetTrackTypeNameFromId,
} from './raceConfig';
export const ColumnConfiguration = (getUserNameFromId, allCarFleets = undefined) => {
  var returnObject = {
    defaultVisibleColumns: ['eventName', 'eventDate', 'createdAt'],
    visibleContentOptions: [
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
            id: 'raceTimeInMin',
            label: i18next.t('events.race.race-time'),
          },
          {
            id: 'raceNumberOfResets',
            label: i18next.t('events.race.resets-per-lap'),
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
            id: 'createdBy',
            label: i18next.t('events.created-by'),
          },
          {
            id: 'eventId',
            label: i18next.t('events.event-id'),
          },
          {
            id: 'eventLandingPageLink',
            label: i18next.t('events.landing-page-link'),
          },
        ],
      },
    ],
    columnDefinitions: [
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
        id: 'trackType',
        header: i18next.t('events.track-type'),
        cell: (item) => GetTrackTypeNameFromId(item.raceConfig.trackType) || '-',
        sortingField: 'trackType',
      },
      {
        id: 'rankingMethod',
        header: i18next.t('events.race.ranking-method'),
        cell: (item) => GetRaceTypeNameFromId(item.raceConfig.rankingMethod) || '-',
        sortingField: 'rankingMethod',
      },
      {
        id: 'raceTimeInMin',
        header: i18next.t('events.race.race-time'),
        cell: (item) => item.raceConfig.raceTimeInMin || '-',
        sortingField: 'raceTimeInMin',
      },
      {
        id: 'raceNumberOfResets',
        header: i18next.t('events.race.resets-per-lap'),
        cell: (item) => GetRaceResetsNameFromId(item.raceConfig.numberOfResetsPerLap) || '-',
        sortingField: 'raceNumberOfResets',
      },
      {
        id: 'country',
        header: i18next.t('events.country'),
        cell: (item) => <Flag countryCode={item.countryCode}></Flag> || '-',
        sortingField: 'country',
      },
      {
        id: 'createdAt',
        header: i18next.t('events.created-at'),
        cell: (item) => formatAwsDateTime(item.createdAt) || '-',
        sortingField: 'createdAt',
      },
      {
        id: 'createdBy',
        header: i18next.t('events.created-by'),
        cell: (item) => getUserNameFromId(item.createdBy) || '-',
        sortingField: 'createdBy',
      },
      {
        id: 'eventId',
        header: i18next.t('events.event-id'),
        cell: (item) => item.eventId || '-',
      },
      {
        id: 'eventLandingPageLink',
        header: i18next.t('events.landing-page-link'),
        cell: (item) =>
          (
            <EventLinksButtons
              href={`${awsconfig.Urls.leaderboardWebsite}/landing-page/${item.eventId.toString()}/`}
              linkTextPrimary={i18next.t('events.link-same-tab')}
              linkTextExternal={i18next.t('events.link-new-tab')}
            />
          ) || '-',
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[1];  // eventDate
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringProperties = () => {
  return [
    {
      key: 'eventName',
      propertyLabel: i18next.t('events.event-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
