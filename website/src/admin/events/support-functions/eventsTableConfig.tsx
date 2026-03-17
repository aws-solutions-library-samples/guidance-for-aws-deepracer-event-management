import { EventLinksButtons } from '../../../components/eventLinksButtons';
import { Flag } from '../../../components/flag';
import awsconfig from '../../../config.json';
import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';
import { Event } from '../../../types/domain';
import {
  GetRaceResetsNameFromId,
  GetRaceTypeNameFromId,
  GetTrackTypeNameFromId,
} from './raceConfig';

/**
 * Column visibility option
 */
interface ColumnOption {
  id: string;
  label: string;
  editable?: boolean;
}

/**
 * Visible content option group
 */
interface VisibleContentOption {
  label: string;
  options: ColumnOption[];
}

/**
 * Column definition for table
 */
interface ColumnDefinition<T = Event> {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  sortingField?: string;
}

/**
 * Table configuration return type
 */
interface TableConfiguration {
  defaultVisibleColumns: string[];
  visibleContentOptions: VisibleContentOption[];
  columnDefinitions: ColumnDefinition[];
  defaultSortingColumn: ColumnDefinition;
  defaultSortingIsDescending: boolean;
}

/**
 * Filtering property for table filtering
 */
interface FilteringProperty {
  key: string;
  propertyLabel: string;
  operators: string[];
}

export const ColumnConfiguration = (
  getUserNameFromId: (userId: string) => string,
  allCarFleets: unknown = undefined
): TableConfiguration => {
  const returnObject = {
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
        cell: (item: Event) => item.eventName || '-',
        sortingField: 'eventName',
      },
      {
        id: 'eventDate',
        header: i18next.t('events.event-date'),
        cell: (item: Event) => item.eventDate || '-',
        sortingField: 'eventDate',
      },
      {
        id: 'trackType',
        header: i18next.t('events.track-type'),
        cell: (item: Event) => GetTrackTypeNameFromId(item.raceConfig?.trackType) || '-',
        sortingField: 'trackType',
      },
      {
        id: 'rankingMethod',
        header: i18next.t('events.race.ranking-method'),
        cell: (item: Event) => GetRaceTypeNameFromId(item.raceConfig?.rankingMethod) || '-',
        sortingField: 'rankingMethod',
      },
      {
        id: 'raceTimeInMin',
        header: i18next.t('events.race.race-time'),
        cell: (item: Event) => item.raceConfig?.raceTimeInMin || '-',
        sortingField: 'raceTimeInMin',
      },
      {
        id: 'raceNumberOfResets',
        header: i18next.t('events.race.resets-per-lap'),
        cell: (item: Event) => GetRaceResetsNameFromId(item.raceConfig?.numberOfResetsPerLap) || '-',
        sortingField: 'raceNumberOfResets',
      },
      {
        id: 'country',
        header: i18next.t('events.country'),
        cell: (item: Event) => <Flag countryCode={item.countryCode}></Flag>,
        sortingField: 'country',
      },
      {
        id: 'createdAt',
        header: i18next.t('events.created-at'),
        cell: (item: Event) => formatAwsDateTime(item.createdAt) || '-',
        sortingField: 'createdAt',
      },
      {
        id: 'createdBy',
        header: i18next.t('events.created-by'),
        cell: (item: Event) => getUserNameFromId(item.createdBy || '') || '-',
        sortingField: 'createdBy',
      },
      {
        id: 'eventId',
        header: i18next.t('events.event-id'),
        cell: (item: Event) => item.eventId || '-',
      },
      {
        id: 'eventLandingPageLink',
        header: i18next.t('events.landing-page-link'),
        cell: (item: Event) =>
          (
            <EventLinksButtons
              href={`${(awsconfig as any).Urls?.leaderboardWebsite || window.location.origin}/landing-page/${item.eventId.toString()}/`}
              linkTextPrimary={i18next.t('events.link-same-tab')}
              linkTextExternal={i18next.t('events.link-new-tab')}
            />
          ),
      },
    ],
    defaultSortingColumn: null as any,  // Will be set below
    defaultSortingIsDescending: true,
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[1];  // eventDate

  return returnObject as TableConfiguration;
};

export const FilteringProperties = (): FilteringProperty[] => {
  return [
    {
      key: 'eventName',
      propertyLabel: i18next.t('events.event-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
