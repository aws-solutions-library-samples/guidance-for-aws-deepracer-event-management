/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const addCarLogsAsset = /* GraphQL */ `
  mutation AddCarLogsAsset(
    $assetId: ID!
    $assetMetaData: AssetMetadataInput
    $carName: String
    $eventId: String
    $eventName: String
    $fetchJobId: String
    $mediaMetaData: MediaMetadataInput
    $models: [CarLogsModelInput]
    $sub: ID!
    $type: CarLogsAssetTypeEnum
    $username: String
  ) {
    addCarLogsAsset(
      assetId: $assetId
      assetMetaData: $assetMetaData
      carName: $carName
      eventId: $eventId
      eventName: $eventName
      fetchJobId: $fetchJobId
      mediaMetaData: $mediaMetaData
      models: $models
      sub: $sub
      type: $type
      username: $username
    ) {
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
export const addEvent = /* GraphQL */ `
  mutation AddEvent(
    $countryCode: String
    $eventDate: AWSDate
    $eventName: String!
    $landingPageConfig: landingPageConfigInputType
    $raceConfig: RaceInputConfig!
    $sponsor: String
    $tracks: [TrackInput]!
    $typeOfEvent: TypeOfEvent!
  ) {
    addEvent(
      countryCode: $countryCode
      eventDate: $eventDate
      eventName: $eventName
      landingPageConfig: $landingPageConfig
      raceConfig: $raceConfig
      sponsor: $sponsor
      tracks: $tracks
      typeOfEvent: $typeOfEvent
    ) {
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
export const addFleet = /* GraphQL */ `
  mutation AddFleet($carIds: [String], $fleetName: String!) {
    addFleet(carIds: $carIds, fleetName: $fleetName) {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const addLeaderboardEntry = /* GraphQL */ `
  mutation AddLeaderboardEntry(
    $avgLapTime: Float
    $avgLapsPerAttempt: Float
    $countryCode: String
    $eventId: ID!
    $fastestAverageLap: LeaderboardAverageLapInput
    $fastestLapTime: Float
    $lapCompletionRatio: Float
    $mostConcecutiveLaps: Int
    $numberOfInvalidLaps: Int
    $numberOfValidLaps: Int
    $racedByProxy: Boolean!
    $trackId: ID!
    $username: String!
  ) {
    addLeaderboardEntry(
      avgLapTime: $avgLapTime
      avgLapsPerAttempt: $avgLapsPerAttempt
      countryCode: $countryCode
      eventId: $eventId
      fastestAverageLap: $fastestAverageLap
      fastestLapTime: $fastestLapTime
      lapCompletionRatio: $lapCompletionRatio
      mostConcecutiveLaps: $mostConcecutiveLaps
      numberOfInvalidLaps: $numberOfInvalidLaps
      numberOfValidLaps: $numberOfValidLaps
      racedByProxy: $racedByProxy
      trackId: $trackId
      username: $username
    ) {
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
export const addModel = /* GraphQL */ `
  mutation AddModel(
    $fileMetaData: FileMetadataInput
    $modelId: ID!
    $modelMD5: String
    $modelMetaData: ModelMetadataInput
    $modelname: String
    $status: ModelStatusEnum!
    $sub: ID!
    $username: String!
  ) {
    addModel(
      fileMetaData: $fileMetaData
      modelId: $modelId
      modelMD5: $modelMD5
      modelMetaData: $modelMetaData
      modelname: $modelname
      status: $status
      sub: $sub
      username: $username
    ) {
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
export const addRace = /* GraphQL */ `
  mutation AddRace(
    $averageLaps: [AverageLapInput]
    $eventId: ID!
    $laps: [LapInput]!
    $racedByProxy: Boolean!
    $trackId: ID!
    $userId: ID!
  ) {
    addRace(
      averageLaps: $averageLaps
      eventId: $eventId
      laps: $laps
      racedByProxy: $racedByProxy
      trackId: $trackId
      userId: $userId
    ) {
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
export const carDeleteAllModels = /* GraphQL */ `
  mutation CarDeleteAllModels(
    $resourceIds: [String!]
    $withSystemLogs: Boolean
  ) {
    carDeleteAllModels(
      resourceIds: $resourceIds
      withSystemLogs: $withSystemLogs
    )
  }
`;
export const carEmergencyStop = /* GraphQL */ `
  mutation CarEmergencyStop($resourceIds: [String!]) {
    carEmergencyStop(resourceIds: $resourceIds)
  }
`;
export const carRestartService = /* GraphQL */ `
  mutation CarRestartService($resourceIds: [String!]) {
    carRestartService(resourceIds: $resourceIds)
  }
`;
export const carSetTaillightColor = /* GraphQL */ `
  mutation CarSetTaillightColor(
    $resourceIds: [String!]
    $selectedColor: String!
  ) {
    carSetTaillightColor(
      resourceIds: $resourceIds
      selectedColor: $selectedColor
    )
  }
`;
export const carsDelete = /* GraphQL */ `
  mutation CarsDelete($resourceIds: [String!]) {
    carsDelete(resourceIds: $resourceIds)
  }
`;
export const carsUpdateFleet = /* GraphQL */ `
  mutation CarsUpdateFleet(
    $fleetId: String!
    $fleetName: String!
    $resourceIds: [String!]
  ) {
    carsUpdateFleet(
      fleetId: $fleetId
      fleetName: $fleetName
      resourceIds: $resourceIds
    ) {
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
export const carsUpdateStatus = /* GraphQL */ `
  mutation CarsUpdateStatus($cars: [carOnlineInput!]) {
    carsUpdateStatus(cars: $cars) {
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
export const createStartFetchFromCarDbEntry = /* GraphQL */ `
  mutation CreateStartFetchFromCarDbEntry(
    $carFleetId: String
    $carFleetName: String
    $carInstanceId: String
    $carIpAddress: String
    $carName: String
    $eventId: ID
    $eventName: String
    $jobId: ID
    $laterThan: AWSDateTime
    $raceData: AWSJSON
    $racerName: String
    $startTime: AWSDateTime
    $status: CarLogsFetchStatus
  ) {
    createStartFetchFromCarDbEntry(
      carFleetId: $carFleetId
      carFleetName: $carFleetName
      carInstanceId: $carInstanceId
      carIpAddress: $carIpAddress
      carName: $carName
      eventId: $eventId
      eventName: $eventName
      jobId: $jobId
      laterThan: $laterThan
      raceData: $raceData
      racerName: $racerName
      startTime: $startTime
      status: $status
    ) {
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
export const createStartUploadToCarDbEntry = /* GraphQL */ `
  mutation CreateStartUploadToCarDbEntry(
    $carFleetId: String
    $carFleetName: String
    $carInstanceId: String
    $carIpAddress: String
    $carName: String
    $eventId: ID
    $eventName: String
    $jobId: ID
    $modelKey: String
    $startTime: AWSDateTime
    $status: String
    $username: String
  ) {
    createStartUploadToCarDbEntry(
      carFleetId: $carFleetId
      carFleetName: $carFleetName
      carInstanceId: $carInstanceId
      carIpAddress: $carIpAddress
      carName: $carName
      eventId: $eventId
      eventName: $eventName
      jobId: $jobId
      modelKey: $modelKey
      startTime: $startTime
      status: $status
      username: $username
    ) {
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
export const createUser = /* GraphQL */ `
  mutation CreateUser(
    $countryCode: String!
    $email: String!
    $username: String!
  ) {
    createUser(countryCode: $countryCode, email: $email, username: $username) {
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
export const deleteCarLogsAsset = /* GraphQL */ `
  mutation DeleteCarLogsAsset($assetId: ID!, $sub: ID) {
    deleteCarLogsAsset(assetId: $assetId, sub: $sub) {
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
export const deleteEvents = /* GraphQL */ `
  mutation DeleteEvents($eventIds: [String]!) {
    deleteEvents(eventIds: $eventIds)
  }
`;
export const deleteFleets = /* GraphQL */ `
  mutation DeleteFleets($fleetIds: [String]!) {
    deleteFleets(fleetIds: $fleetIds) {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const deleteLeaderboardEntry = /* GraphQL */ `
  mutation DeleteLeaderboardEntry(
    $eventId: ID!
    $trackId: ID!
    $username: String!
  ) {
    deleteLeaderboardEntry(
      eventId: $eventId
      trackId: $trackId
      username: $username
    ) {
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
export const deleteModel = /* GraphQL */ `
  mutation DeleteModel($modelId: ID!, $sub: ID) {
    deleteModel(modelId: $modelId, sub: $sub) {
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
export const deleteRaces = /* GraphQL */ `
  mutation DeleteRaces($eventId: ID!, $racesToDelete: [RaceDeleteInput]!) {
    deleteRaces(eventId: $eventId, racesToDelete: $racesToDelete) {
      eventId
      raceIds
      __typename
    }
  }
`;
export const deleteUser = /* GraphQL */ `
  mutation DeleteUser($username: String!) {
    deleteUser(username: $username) {
      Deleted
      Username
      __typename
    }
  }
`;
export const deviceActivation = /* GraphQL */ `
  mutation DeviceActivation(
    $deviceType: String!
    $deviceUiPassword: String!
    $fleetId: ID!
    $fleetName: String!
    $hostname: String!
  ) {
    deviceActivation(
      deviceType: $deviceType
      deviceUiPassword: $deviceUiPassword
      fleetId: $fleetId
      fleetName: $fleetName
      hostname: $hostname
    ) {
      activationCode
      activationId
      region
      __typename
    }
  }
`;
export const startFetchFromCar = /* GraphQL */ `
  mutation StartFetchFromCar(
    $carFleetId: String
    $carFleetName: String
    $carInstanceId: String
    $carIpAddress: String
    $carName: String
    $eventId: ID
    $eventName: String
    $laterThan: AWSDateTime
    $raceData: AWSJSON
    $racerName: String
  ) {
    startFetchFromCar(
      carFleetId: $carFleetId
      carFleetName: $carFleetName
      carInstanceId: $carInstanceId
      carIpAddress: $carIpAddress
      carName: $carName
      eventId: $eventId
      eventName: $eventName
      laterThan: $laterThan
      raceData: $raceData
      racerName: $racerName
    ) {
      jobId
      __typename
    }
  }
`;
export const startUploadToCar = /* GraphQL */ `
  mutation StartUploadToCar(
    $carFleetId: String
    $carFleetName: String
    $carInstanceId: String
    $carIpAddress: String
    $carName: String
    $eventId: ID
    $eventName: String
    $modelData: [modelData]
  ) {
    startUploadToCar(
      carFleetId: $carFleetId
      carFleetName: $carFleetName
      carInstanceId: $carInstanceId
      carIpAddress: $carIpAddress
      carName: $carName
      eventId: $eventId
      eventName: $eventName
      modelData: $modelData
    ) {
      jobId
      __typename
    }
  }
`;
export const updateEvent = /* GraphQL */ `
  mutation UpdateEvent(
    $countryCode: String
    $eventDate: AWSDate
    $eventId: String!
    $eventName: String!
    $landingPageConfig: landingPageConfigInputType
    $raceConfig: RaceInputConfig!
    $sponsor: String
    $tracks: [TrackInput]!
    $typeOfEvent: TypeOfEvent!
  ) {
    updateEvent(
      countryCode: $countryCode
      eventDate: $eventDate
      eventId: $eventId
      eventName: $eventName
      landingPageConfig: $landingPageConfig
      raceConfig: $raceConfig
      sponsor: $sponsor
      tracks: $tracks
      typeOfEvent: $typeOfEvent
    ) {
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
export const updateFetchFromCarDbEntry = /* GraphQL */ `
  mutation UpdateFetchFromCarDbEntry(
    $endTime: AWSDateTime
    $fetchStartTime: AWSDateTime
    $jobId: ID
    $status: CarLogsFetchStatus
    $uploadKey: String
  ) {
    updateFetchFromCarDbEntry(
      endTime: $endTime
      fetchStartTime: $fetchStartTime
      jobId: $jobId
      status: $status
      uploadKey: $uploadKey
    ) {
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
export const updateFleet = /* GraphQL */ `
  mutation UpdateFleet($carIds: [ID], $fleetId: String!, $fleetName: String) {
    updateFleet(carIds: $carIds, fleetId: $fleetId, fleetName: $fleetName) {
      carIds
      createdAt
      createdBy
      fleetId
      fleetName
      __typename
    }
  }
`;
export const updateLeaderboardEntry = /* GraphQL */ `
  mutation UpdateLeaderboardEntry(
    $avgLapTime: Float
    $avgLapsPerAttempt: Float
    $countryCode: String
    $eventId: ID!
    $fastestAverageLap: LeaderboardAverageLapInput
    $fastestLapTime: Float
    $lapCompletionRatio: Float
    $mostConcecutiveLaps: Int
    $numberOfInvalidLaps: Int
    $numberOfValidLaps: Int
    $racedByProxy: Boolean!
    $trackId: ID!
    $username: String!
  ) {
    updateLeaderboardEntry(
      avgLapTime: $avgLapTime
      avgLapsPerAttempt: $avgLapsPerAttempt
      countryCode: $countryCode
      eventId: $eventId
      fastestAverageLap: $fastestAverageLap
      fastestLapTime: $fastestLapTime
      lapCompletionRatio: $lapCompletionRatio
      mostConcecutiveLaps: $mostConcecutiveLaps
      numberOfInvalidLaps: $numberOfInvalidLaps
      numberOfValidLaps: $numberOfValidLaps
      racedByProxy: $racedByProxy
      trackId: $trackId
      username: $username
    ) {
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
export const updateModel = /* GraphQL */ `
  mutation UpdateModel(
    $fileMetaData: FileMetadataInput
    $modelId: ID!
    $modelMD5: String
    $modelMetaData: ModelMetadataInput
    $modelname: String
    $status: ModelStatusEnum
    $sub: ID!
    $username: String
  ) {
    updateModel(
      fileMetaData: $fileMetaData
      modelId: $modelId
      modelMD5: $modelMD5
      modelMetaData: $modelMetaData
      modelname: $modelname
      status: $status
      sub: $sub
      username: $username
    ) {
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
export const updateOverlayInfo = /* GraphQL */ `
  mutation UpdateOverlayInfo(
    $averageLaps: [AverageLapInput]
    $countryCode: String
    $currentLapTimeInMs: Float
    $eventId: ID!
    $eventName: String
    $laps: [LapInput]
    $raceStatus: RaceStatusEnum!
    $timeLeftInMs: Float
    $trackId: ID
    $userId: String
    $username: String
  ) {
    updateOverlayInfo(
      averageLaps: $averageLaps
      countryCode: $countryCode
      currentLapTimeInMs: $currentLapTimeInMs
      eventId: $eventId
      eventName: $eventName
      laps: $laps
      raceStatus: $raceStatus
      timeLeftInMs: $timeLeftInMs
      trackId: $trackId
      userId: $userId
      username: $username
    ) {
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
export const updateRace = /* GraphQL */ `
  mutation UpdateRace(
    $averageLaps: [AverageLapInput]!
    $eventId: ID!
    $laps: [LapInput]!
    $raceId: ID!
    $racedByProxy: Boolean!
    $trackId: ID!
    $userId: ID!
  ) {
    updateRace(
      averageLaps: $averageLaps
      eventId: $eventId
      laps: $laps
      raceId: $raceId
      racedByProxy: $racedByProxy
      trackId: $trackId
      userId: $userId
    ) {
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
export const updateUploadToCarDbEntry = /* GraphQL */ `
  mutation UpdateUploadToCarDbEntry(
    $endTime: AWSDateTime
    $eventId: ID
    $jobId: ID
    $modelKey: String
    $status: String
    $uploadStartTime: AWSDateTime
  ) {
    updateUploadToCarDbEntry(
      endTime: $endTime
      eventId: $eventId
      jobId: $jobId
      modelKey: $modelKey
      status: $status
      uploadStartTime: $uploadStartTime
    ) {
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
export const updateUser = /* GraphQL */ `
  mutation UpdateUser($roles: [String]!, $username: String!) {
    updateUser(roles: $roles, username: $username) {
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
export const uploadModelToCar = /* GraphQL */ `
  mutation UploadModelToCar($entry: UploadModelToCarInput!) {
    uploadModelToCar(entry: $entry) {
      carInstanceId
      modelId
      ssmCommandId
      __typename
    }
  }
`;
export const userCreated = /* GraphQL */ `
  mutation UserCreated(
    $Attributes: [UserObjectAttributesInput]
    $Enabled: Boolean
    $MFAOptions: [UsersObjectMfaOptionsInput]
    $UserCreateDate: AWSDateTime
    $UserLastModifiedDate: AWSDateTime
    $UserStatus: String
    $Username: String
    $sub: ID
  ) {
    userCreated(
      Attributes: $Attributes
      Enabled: $Enabled
      MFAOptions: $MFAOptions
      UserCreateDate: $UserCreateDate
      UserLastModifiedDate: $UserLastModifiedDate
      UserStatus: $UserStatus
      Username: $Username
      sub: $sub
    ) {
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
