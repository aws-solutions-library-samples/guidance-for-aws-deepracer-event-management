/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onAddedCarLogsAsset = /* GraphQL */ `
  subscription OnAddedCarLogsAsset($sub: ID) {
    onAddedCarLogsAsset(sub: $sub) {
      assetId
      assetMetaData {
        filename
        key
        uploadedDateTime
        __typename
      }
      carName
      eventId
      eventName
      fetchJobId
      mediaMetaData {
        codec
        duration
        fps
        resolution
        __typename
      }
      models {
        modelId
        modelName
        __typename
      }
      sub
      type
      username
      __typename
    }
  }
`;
export const onAddedEvent = /* GraphQL */ `
  subscription OnAddedEvent {
    onAddedEvent {
      countryCode
      createdAt
      createdBy
      eventDate
      eventId
      eventName
      landingPageConfig {
        links {
          linkDescription
          linkHref
          linkName
          __typename
        }
        __typename
      }
      raceConfig {
        averageLapsWindow
        maxRunsPerRacer
        numberOfResetsPerLap
        raceTimeInMin
        rankingMethod
        trackType
        __typename
      }
      sponsor
      tracks {
        fleetId
        leaderBoardFooter
        leaderBoardTitle
        trackId
        __typename
      }
      typeOfEvent
      __typename
    }
  }
`;
export const onAddedFleet = /* GraphQL */ `
  subscription OnAddedFleet {
    onAddedFleet {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const onAddedModel = /* GraphQL */ `
  subscription OnAddedModel($sub: ID) {
    onAddedModel(sub: $sub) {
      fileMetaData {
        filename
        key
        uploadedDateTime
        __typename
      }
      modelId
      modelMD5
      modelMetaData {
        actionSpaceType
        metadataMd5
        sensor
        trainingAlgorithm
        __typename
      }
      modelname
      status
      sub
      username
      __typename
    }
  }
`;
export const onAddedRace = /* GraphQL */ `
  subscription OnAddedRace($eventId: ID!, $trackId: ID) {
    onAddedRace(eventId: $eventId, trackId: $trackId) {
      averageLaps {
        avgTime
        endLapId
        startLapId
        __typename
      }
      createdAt
      eventId
      laps {
        autTimerConnected
        carName
        isValid
        lapId
        resets
        time
        __typename
      }
      raceId
      racedByProxy
      trackId
      userId
      __typename
    }
  }
`;
export const onDeleteLeaderboardEntry = /* GraphQL */ `
  subscription OnDeleteLeaderboardEntry($eventId: ID!, $trackId: ID) {
    onDeleteLeaderboardEntry(eventId: $eventId, trackId: $trackId) {
      avgLapTime
      avgLapsPerAttempt
      countryCode
      eventId
      fastestAverageLap {
        avgTime
        endLapId
        startLapId
        __typename
      }
      fastestLapTime
      lapCompletionRatio
      mostConcecutiveLaps
      numberOfInvalidLaps
      numberOfValidLaps
      racedByProxy
      trackId
      username
      __typename
    }
  }
`;
export const onDeletedCarLogsAsset = /* GraphQL */ `
  subscription OnDeletedCarLogsAsset($sub: ID) {
    onDeletedCarLogsAsset(sub: $sub) {
      assetId
      assetMetaData {
        filename
        key
        uploadedDateTime
        __typename
      }
      carName
      eventId
      eventName
      fetchJobId
      mediaMetaData {
        codec
        duration
        fps
        resolution
        __typename
      }
      models {
        modelId
        modelName
        __typename
      }
      sub
      type
      username
      __typename
    }
  }
`;
export const onDeletedEvents = /* GraphQL */ `
  subscription OnDeletedEvents {
    onDeletedEvents
  }
`;
export const onDeletedFleets = /* GraphQL */ `
  subscription OnDeletedFleets {
    onDeletedFleets {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const onDeletedModel = /* GraphQL */ `
  subscription OnDeletedModel($sub: ID) {
    onDeletedModel(sub: $sub) {
      fileMetaData {
        filename
        key
        uploadedDateTime
        __typename
      }
      modelId
      modelMD5
      modelMetaData {
        actionSpaceType
        metadataMd5
        sensor
        trainingAlgorithm
        __typename
      }
      modelname
      status
      sub
      username
      __typename
    }
  }
`;
export const onDeletedRaces = /* GraphQL */ `
  subscription OnDeletedRaces($eventId: ID!, $trackId: ID) {
    onDeletedRaces(eventId: $eventId, trackId: $trackId) {
      eventId
      raceIds
      __typename
    }
  }
`;
export const onFetchesFromCarCreated = /* GraphQL */ `
  subscription OnFetchesFromCarCreated($eventId: ID, $jobId: ID) {
    onFetchesFromCarCreated(eventId: $eventId, jobId: $jobId) {
      carFleetId
      carFleetName
      carInstanceId
      carIpAddress
      carName
      endTime
      eventId
      eventName
      fetchStartTime
      jobId
      laterThan
      raceData
      racerName
      startTime
      status
      uploadKey
      __typename
    }
  }
`;
export const onFetchesFromCarUpdated = /* GraphQL */ `
  subscription OnFetchesFromCarUpdated($eventId: ID, $jobId: ID) {
    onFetchesFromCarUpdated(eventId: $eventId, jobId: $jobId) {
      carFleetId
      carFleetName
      carInstanceId
      carIpAddress
      carName
      endTime
      eventId
      eventName
      fetchStartTime
      jobId
      laterThan
      raceData
      racerName
      startTime
      status
      uploadKey
      __typename
    }
  }
`;
export const onNewLeaderboardEntry = /* GraphQL */ `
  subscription OnNewLeaderboardEntry($eventId: ID!, $trackId: ID) {
    onNewLeaderboardEntry(eventId: $eventId, trackId: $trackId) {
      avgLapTime
      avgLapsPerAttempt
      countryCode
      eventId
      fastestAverageLap {
        avgTime
        endLapId
        startLapId
        __typename
      }
      fastestLapTime
      lapCompletionRatio
      mostConcecutiveLaps
      numberOfInvalidLaps
      numberOfValidLaps
      racedByProxy
      trackId
      username
      __typename
    }
  }
`;
export const onNewOverlayInfo = /* GraphQL */ `
  subscription OnNewOverlayInfo($eventId: ID!, $trackId: ID) {
    onNewOverlayInfo(eventId: $eventId, trackId: $trackId) {
      averageLaps {
        avgTime
        endLapId
        startLapId
        __typename
      }
      countryCode
      currentLapTimeInMs
      eventId
      eventName
      laps {
        autTimerConnected
        carName
        isValid
        lapId
        resets
        time
        __typename
      }
      raceStatus
      timeLeftInMs
      trackId
      userId
      username
      __typename
    }
  }
`;
export const onUpdateLeaderboardEntry = /* GraphQL */ `
  subscription OnUpdateLeaderboardEntry($eventId: ID!, $trackId: ID) {
    onUpdateLeaderboardEntry(eventId: $eventId, trackId: $trackId) {
      avgLapTime
      avgLapsPerAttempt
      countryCode
      eventId
      fastestAverageLap {
        avgTime
        endLapId
        startLapId
        __typename
      }
      fastestLapTime
      lapCompletionRatio
      mostConcecutiveLaps
      numberOfInvalidLaps
      numberOfValidLaps
      racedByProxy
      trackId
      username
      __typename
    }
  }
`;
export const onUpdatedCarsInfo = /* GraphQL */ `
  subscription OnUpdatedCarsInfo {
    onUpdatedCarsInfo {
      ActivationId
      AgentVersion
      ComputerName
      DeepRacerCoreVersion
      DeviceUiPassword
      IamRole
      InstanceId
      IpAddress
      IsLatestVersion
      LastPingDateTime
      LoggingCapable
      Name
      PingStatus
      PlatformName
      PlatformType
      PlatformVersion
      RegistrationDate
      ResourceType
      Type
      fleetId
      fleetName
      __typename
    }
  }
`;
export const onUpdatedEvent = /* GraphQL */ `
  subscription OnUpdatedEvent {
    onUpdatedEvent {
      countryCode
      createdAt
      createdBy
      eventDate
      eventId
      eventName
      landingPageConfig {
        links {
          linkDescription
          linkHref
          linkName
          __typename
        }
        __typename
      }
      raceConfig {
        averageLapsWindow
        maxRunsPerRacer
        numberOfResetsPerLap
        raceTimeInMin
        rankingMethod
        trackType
        __typename
      }
      sponsor
      tracks {
        fleetId
        leaderBoardFooter
        leaderBoardTitle
        trackId
        __typename
      }
      typeOfEvent
      __typename
    }
  }
`;
export const onUpdatedFleet = /* GraphQL */ `
  subscription OnUpdatedFleet {
    onUpdatedFleet {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const onUpdatedModel = /* GraphQL */ `
  subscription OnUpdatedModel($sub: ID) {
    onUpdatedModel(sub: $sub) {
      fileMetaData {
        filename
        key
        uploadedDateTime
        __typename
      }
      modelId
      modelMD5
      modelMetaData {
        actionSpaceType
        metadataMd5
        sensor
        trainingAlgorithm
        __typename
      }
      modelname
      status
      sub
      username
      __typename
    }
  }
`;
export const onUpdatedRace = /* GraphQL */ `
  subscription OnUpdatedRace($eventId: ID!, $trackId: ID) {
    onUpdatedRace(eventId: $eventId, trackId: $trackId) {
      averageLaps {
        avgTime
        endLapId
        startLapId
        __typename
      }
      createdAt
      eventId
      laps {
        autTimerConnected
        carName
        isValid
        lapId
        resets
        time
        __typename
      }
      raceId
      racedByProxy
      trackId
      userId
      __typename
    }
  }
`;
export const onUploadsToCarCreated = /* GraphQL */ `
  subscription OnUploadsToCarCreated($eventId: ID, $jobId: ID) {
    onUploadsToCarCreated(eventId: $eventId, jobId: $jobId) {
      carFleetId
      carFleetName
      carInstanceId
      carIpAddress
      carName
      endTime
      eventId
      eventName
      jobId
      modelKey
      startTime
      status
      uploadStartTime
      username
      __typename
    }
  }
`;
export const onUploadsToCarUpdated = /* GraphQL */ `
  subscription OnUploadsToCarUpdated($eventId: ID, $jobId: ID) {
    onUploadsToCarUpdated(eventId: $eventId, jobId: $jobId) {
      carFleetId
      carFleetName
      carInstanceId
      carIpAddress
      carName
      endTime
      eventId
      eventName
      jobId
      modelKey
      startTime
      status
      uploadStartTime
      username
      __typename
    }
  }
`;
export const onUserCreated = /* GraphQL */ `
  subscription OnUserCreated {
    onUserCreated {
      Attributes {
        Name
        Value
        __typename
      }
      Enabled
      MFAOptions {
        Name
        Value
        __typename
      }
      Roles
      UserCreateDate
      UserLastModifiedDate
      UserStatus
      Username
      sub
      __typename
    }
  }
`;
export const onUserUpdated = /* GraphQL */ `
  subscription OnUserUpdated {
    onUserUpdated {
      Attributes {
        Name
        Value
        __typename
      }
      Enabled
      MFAOptions {
        Name
        Value
        __typename
      }
      Roles
      UserCreateDate
      UserLastModifiedDate
      UserStatus
      Username
      sub
      __typename
    }
  }
`;
