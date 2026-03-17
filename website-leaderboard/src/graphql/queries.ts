/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const availableTaillightColors = /* GraphQL */ `
  query AvailableTaillightColors {
    availableTaillightColors
  }
`;
export const carPrintableLabel = /* GraphQL */ `
  query CarPrintableLabel($instanceId: String) {
    carPrintableLabel(instanceId: $instanceId)
  }
`;
export const getAllCarLogsAssets = /* GraphQL */ `
  query GetAllCarLogsAssets(
    $limit: Int
    $nextToken: String
    $user_sub: String
  ) {
    getAllCarLogsAssets(
      limit: $limit
      nextToken: $nextToken
      user_sub: $user_sub
    ) {
      assets {
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
      nextToken
      __typename
    }
  }
`;
export const getAllFleets = /* GraphQL */ `
  query GetAllFleets {
    getAllFleets {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const getAllModels = /* GraphQL */ `
  query GetAllModels($limit: Int, $nextToken: String, $user_sub: String) {
    getAllModels(limit: $limit, nextToken: $nextToken, user_sub: $user_sub) {
      models {
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
      nextToken
      __typename
    }
  }
`;
export const getCarLogsAssetsDownloadLinks = /* GraphQL */ `
  query GetCarLogsAssetsDownloadLinks(
    $assetSubPairs: [CarLogsAssetSubPairsInput!]
  ) {
    getCarLogsAssetsDownloadLinks(assetSubPairs: $assetSubPairs) {
      assetId
      downloadLink
      __typename
    }
  }
`;
export const getEvents = /* GraphQL */ `
  query GetEvents {
    getEvents {
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
export const getLandingPageConfig = /* GraphQL */ `
  query GetLandingPageConfig($eventId: String!) {
    getLandingPageConfig(eventId: $eventId) {
      links {
        linkDescription
        linkHref
        linkName
        __typename
      }
      __typename
    }
  }
`;
export const getLeaderboard = /* GraphQL */ `
  query GetLeaderboard($eventId: ID!, $trackId: ID) {
    getLeaderboard(eventId: $eventId, trackId: $trackId) {
      config {
        leaderBoardFooter
        leaderBoardTitle
        sponsor
        __typename
      }
      entries {
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
      __typename
    }
  }
`;
export const getRaces = /* GraphQL */ `
  query GetRaces($eventId: String!) {
    getRaces(eventId: $eventId) {
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
export const getUploadModelToCarStatus = /* GraphQL */ `
  query GetUploadModelToCarStatus(
    $carInstanceId: String!
    $ssmCommandId: String!
  ) {
    getUploadModelToCarStatus(
      carInstanceId: $carInstanceId
      ssmCommandId: $ssmCommandId
    ) {
      carInstanceId
      ssmCommandId
      ssmCommandStatus
      __typename
    }
  }
`;
export const listCars = /* GraphQL */ `
  query ListCars($online: Boolean!) {
    listCars(online: $online) {
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
export const listFetchesFromCar = /* GraphQL */ `
  query ListFetchesFromCar($eventId: ID, $jobId: ID) {
    listFetchesFromCar(eventId: $eventId, jobId: $jobId) {
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
export const listUploadsToCar = /* GraphQL */ `
  query ListUploadsToCar($eventId: ID, $jobId: ID) {
    listUploadsToCar(eventId: $eventId, jobId: $jobId) {
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
export const listUsers = /* GraphQL */ `
  query ListUsers($username_prefix: String) {
    listUsers(username_prefix: $username_prefix) {
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
export const updateLeaderboardConfigs = /* GraphQL */ `
  query UpdateLeaderboardConfigs(
    $eventId: String!
    $leaderboardConfigs: [LeaderBoardConfigInputType]!
  ) {
    updateLeaderboardConfigs(
      eventId: $eventId
      leaderboardConfigs: $leaderboardConfigs
    ) {
      leaderBoardFooter
      leaderBoardTitle
      sponsor
      __typename
    }
  }
`;
