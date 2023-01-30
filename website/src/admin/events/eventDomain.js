export const event = {
  eventId: undefined,
  generalConfig: {
    eventName: undefined,
    eventDate: undefined,
    countryCode: undefined,
  },
  fleetConfig: { fleetId: undefined },
  raceConfig: {
    trackType: undefined,
    rankingMethod: undefined,
    raceTimeInMin: undefined,
    allowedNrOfResets: undefined,
    lapsToFinish: undefined,
  },
};

export const ConvertFeEventToBeEvent = (event) => {
  return {
    eventId: event.eventId,
    raceNumberOfResets: event.raceConfig.allowedNrOfResets,
    raceTimeInMin: event.raceConfig.raceTimeInMin,
    raceRankingMethod: event.raceConfig.rankingMethod,
    raceLapsToFinish: event.raceConfig.lapsToFinish,
    raceTrackType: event.raceConfig.trackType,
    ...event.fleetConfig,
    ...event.generalConfig,
  };
};

export const ConvertBeEventToFeEvent = (event) => {
  let raceNumberOfResets;
  let raceTimeInMin;
  let raceLapsToFinish;
  if (Number.isInteger(event.raceNumberOfResets)) {
    raceNumberOfResets = event.raceNumberOfResets.toString();
  }
  if (Number.isInteger(event.raceTimeInMin)) {
    raceTimeInMin = event.raceTimeInMin.toString();
  }
  if (Number.isInteger(event.raceLapsToFinish)) {
    raceLapsToFinish = event.raceLapsToFinish.toString();
  }

  return {
    eventId: event.eventId,
    generalConfig: {
      eventName: event.eventName,
      eventDate: event.eventDate ? event.eventDate : undefined,
      countryCode: event.countryCode,
    },
    fleetConfig: { fleetId: event.fleetId },
    raceConfig: {
      rankingMethod: event.raceRankingMethod,
      raceTimeInMin: raceTimeInMin,
      allowedNrOfResets: raceNumberOfResets,
      lapsToFinish: raceLapsToFinish,
      trackType: event.raceTrackType,
    },
  };
};
