/* eslint-disable */
// TypeScript version of auto-generated GraphQL subscriptions
// Must match schema.graphql — validated by graphql-schema-conformance.test.ts

export const onAddedCarLogsAsset = /* GraphQL */ `
    subscription OnAddedCarLogsAsset($sub: ID) {
        onAddedCarLogsAsset(sub: $sub) {
            assetId
            assetMetaData {
                filename
                key
                uploadedDateTime
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
            }
            models {
                modelId
                modelName
            }
            sub
            type
            username
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
                }
            }
            raceConfig {
                averageLapsWindow
                maxRunsPerRacer
                numberOfResetsPerLap
                raceTimeInMin
                rankingMethod
                trackType
            }
            sponsor
            tracks {
                fleetId
                leaderBoardFooter
                leaderBoardTitle
                trackId
            }
            typeOfEvent
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
            }
            modelId
            modelMD5
            modelMetaData {
                actionSpaceType
                metadataMd5
                sensor
                trainingAlgorithm
            }
            modelname
            status
            sub
            username
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
            }
            raceId
            racedByProxy
            trackId
            userId
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
            }
            fastestLapTime
            lapCompletionRatio
            mostConcecutiveLaps
            numberOfInvalidLaps
            numberOfValidLaps
            racedByProxy
            trackId
            username
            avatarConfig
            highlightColour
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
            }
            models {
                modelId
                modelName
            }
            sub
            type
            username
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
            }
            modelId
            modelMD5
            modelMetaData {
                actionSpaceType
                metadataMd5
                sensor
                trainingAlgorithm
            }
            modelname
            status
            sub
            username
        }
    }
`;
export const onDeletedRaces = /* GraphQL */ `
    subscription OnDeletedRaces($eventId: ID!, $trackId: ID) {
        onDeletedRaces(eventId: $eventId, trackId: $trackId) {
            eventId
            raceIds
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
            }
            fastestLapTime
            lapCompletionRatio
            mostConcecutiveLaps
            numberOfInvalidLaps
            numberOfValidLaps
            racedByProxy
            trackId
            username
            avatarConfig
            highlightColour
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
            }
            raceStatus
            timeLeftInMs
            trackId
            userId
            username
            avatarConfig
            highlightColour
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
            }
            fastestLapTime
            lapCompletionRatio
            mostConcecutiveLaps
            numberOfInvalidLaps
            numberOfValidLaps
            racedByProxy
            trackId
            username
            avatarConfig
            highlightColour
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
                }
            }
            raceConfig {
                averageLapsWindow
                maxRunsPerRacer
                numberOfResetsPerLap
                raceTimeInMin
                rankingMethod
                trackType
            }
            sponsor
            tracks {
                fleetId
                leaderBoardFooter
                leaderBoardTitle
                trackId
            }
            typeOfEvent
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
            }
            modelId
            modelMD5
            modelMetaData {
                actionSpaceType
                metadataMd5
                sensor
                trainingAlgorithm
            }
            modelname
            status
            sub
            username
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
            }
            raceId
            racedByProxy
            trackId
            userId
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
        }
    }
`;
export const onUserCreated = /* GraphQL */ `
    subscription OnUserCreated {
        onUserCreated {
            Attributes {
                Name
                Value
            }
            Enabled
            MFAOptions {
                Name
                Value
            }
            Roles
            UserCreateDate
            UserLastModifiedDate
            UserStatus
            Username
            sub
        }
    }
`;
export const onUserUpdated = /* GraphQL */ `
    subscription OnUserUpdated {
        onUserUpdated {
            Attributes {
                Name
                Value
            }
            Enabled
            MFAOptions {
                Name
                Value
            }
            Roles
            UserCreateDate
            UserLastModifiedDate
            UserStatus
            Username
            sub
        }
    }
`;
