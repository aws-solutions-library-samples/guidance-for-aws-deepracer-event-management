/* eslint-disable */
// TypeScript version of auto-generated GraphQL queries
// Must match schema.graphql — validated by graphql-schema-conformance.test.ts

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
    query GetAllCarLogsAssets($limit: Int, $nextToken: String, $user_sub: String) {
        getAllCarLogsAssets(limit: $limit, nextToken: $nextToken, user_sub: $user_sub) {
            assets {
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
            nextToken
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
            nextToken
        }
    }
`;
export const getCarLogsAssetsDownloadLinks = /* GraphQL */ `
    query GetCarLogsAssetsDownloadLinks($assetSubPairs: [CarLogsAssetSubPairsInput!]) {
        getCarLogsAssetsDownloadLinks(assetSubPairs: $assetSubPairs) {
            assetId
            downloadLink
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
export const getLandingPageConfig = /* GraphQL */ `
    query GetLandingPageConfig($eventId: String!) {
        getLandingPageConfig(eventId: $eventId) {
            links {
                linkDescription
                linkHref
                linkName
            }
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
                }
                fastestLapTime
                lapCompletionRatio
                mostConcecutiveLaps
                numberOfInvalidLaps
                numberOfValidLaps
                racedByProxy
                trackId
                username
                profile {
                    username
                    avatarConfig
                    highlightColour
                }
            }
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
export const getUploadModelToCarStatus = /* GraphQL */ `
    query GetUploadModelToCarStatus($carInstanceId: String!, $ssmCommandId: String!) {
        getUploadModelToCarStatus(carInstanceId: $carInstanceId, ssmCommandId: $ssmCommandId) {
            carInstanceId
            ssmCommandId
            ssmCommandStatus
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
        }
    }
`;
export const listUsers = /* GraphQL */ `
    query ListUsers($username_prefix: String) {
        listUsers(username_prefix: $username_prefix) {
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
export const getRacerProfile = /* GraphQL */ `
    query GetRacerProfile($username: String!) {
        getRacerProfile(username: $username) {
            username
            avatarConfig
            highlightColour
            updatedAt
        }
    }
`;

export const getUserRoles = /* GraphQL */ `
    query GetUserRoles($username: String!) {
        getUserRoles(username: $username) {
            Username
            Roles
        }
    }
`;

export const updateLeaderboardConfigs = /* GraphQL */ `
    query UpdateLeaderboardConfigs(
        $eventId: String!
        $leaderboardConfigs: [LeaderBoardConfigInputType]!
    ) {
        updateLeaderboardConfigs(eventId: $eventId, leaderboardConfigs: $leaderboardConfigs) {
            leaderBoardFooter
            leaderBoardTitle
            sponsor
        }
    }
`;
