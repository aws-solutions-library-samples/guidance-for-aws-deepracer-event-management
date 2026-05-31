import { EventLinksButtons } from '../../../components/eventLinksButtons';
import { Flag } from '../../../components/flag';
import awsconfig from '../../../config.json';
import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';
import { Event } from '../../../types/domain';
import { EventTypeConfig, GetTypeOfEventNameFromId } from './eventDomain';
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

/**
 * Filtering option — pre-populates dropdown values for a property,
 * matching the CloudScape PropertyFilter `FilteringOption` shape.
 */
interface FilteringOption {
  propertyKey: string;
  value: string;
  label: string;
}

export const ColumnConfiguration = (
  getUserNameFromId: (userId: string) => string,
  allCarFleets: unknown = undefined
): TableConfiguration => {
  const returnObject = {
    defaultVisibleColumns: ['eventName', 'eventDate', 'typeOfEvent', 'createdAt'],
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
            id: 'typeOfEvent',
            label: i18next.t('events.event-type'),
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
        id: 'typeOfEvent',
        header: i18next.t('events.event-type'),
        cell: (item: Event) => GetTypeOfEventNameFromId(item.typeOfEvent) || '-',
        sortingField: 'typeOfEvent',
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
        cell: (item: Event) =>
          GetRaceResetsNameFromId(item.raceConfig?.numberOfResetsPerLap) || '-',
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
        cell: (item: Event) => (
          <EventLinksButtons
            href={`${window.location.origin}/leaderboard/landing-page/${item.eventId.toString()}/`}
            linkTextPrimary={i18next.t('events.link-same-tab')}
            linkTextExternal={i18next.t('events.link-new-tab')}
          />
        ),
      },
    ],
    defaultSortingColumn: null as any, // Will be set below
    defaultSortingIsDescending: true,
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[1]; // eventDate

  return returnObject as TableConfiguration;
};

export const FilteringProperties = (): FilteringProperty[] => {
  return [
    {
      key: 'eventName',
      propertyLabel: i18next.t('events.event-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'typeOfEvent',
      propertyLabel: i18next.t('events.event-type'),
      // typeOfEvent is an enum — only equality/inequality make sense.
      operators: ['=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};

/**
 * Pre-populated filter values, used by the PropertyFilter to render a
 * dropdown of valid `typeOfEvent` values instead of forcing the operator
 * to type the raw enum string.
 */
export const FilteringOptions = (): FilteringOption[] => {
  return EventTypeConfig().map((option) => ({
    propertyKey: 'typeOfEvent',
    value: option.value,
    label: option.label,
  }));
};
