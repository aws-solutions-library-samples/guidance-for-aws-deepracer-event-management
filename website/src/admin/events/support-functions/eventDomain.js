import i18next from '../../../i18n';

export const event = {
  eventDate: undefined,
  countryCode: undefined,
  fleetId: undefined,
  typeOfEvent: undefined,
  tracks: [
    {
      trackId: 1,
      raceConfig: {
        rankingMethod: 'BEST_LAP_TIME',
        raceTimeInMin: '3',
        numberOfResetsPerLap: '9999',
        trackType: 'REINVENT_2018',
      },
      leaderboardConfig: {
        footerText: 'Follow the race #AWSDeepRacer',
        headerText: undefined,
        sponsor: undefined,
      },
      landingPageConfig: {
        links: [
          {
            linkName: 'Upload your own model and race',
            linkDescription: 'Upload your own autonomous racing model here and get started racing!',
            linkHref: `${window.location.origin}/upload`,
          },
        ],
      },
    },
  ],
};

export const EventTypeConfig = () => {
  return [
    { label: i18next.t('events.type.private-workshop'), value: 'PRIVATE_WORKSHOP' },
    { label: i18next.t('events.type.offical-workshop'), value: 'OFFICIAL_WORKSHOP' },
    { label: i18next.t('events.type.private-track-race'), value: 'PRIVATE_TRACK_RACE' },
    { label: i18next.t('events.type.official-track-race'), value: 'OFFICIAL_TRACK_RACE' },
    { label: i18next.t('events.type.other'), value: 'OTHER' },
  ];
};

export const GetTypeOfEventNameFromId = (id) => {
  if (!id) return;
  const options = EventTypeConfig();
  const item = options.find((item) => item.value.toString() === id.toString());
  if (item) {
    return item.label;
  }
  return undefined;
};

export const GetTypeOfEventOptionFromId = (id) => {
  if (!id) return;
  const options = EventTypeConfig();
  const item = options.find((item) => item.value.toString() === id.toString());
  if (item) {
    return item;
  }
  return undefined;
};
