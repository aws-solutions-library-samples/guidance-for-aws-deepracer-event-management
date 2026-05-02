// Domain model interfaces for the application
import {
    AssetStatusEnum,
    DeviceStatusEnum,
    EventTypeEnum,
    RaceFormatEnum,
    RaceStatusEnum,
    RaceTypeEnum,
    UploadStatusEnum,
    UserRoleEnum,
} from './enums';

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Track interface
export interface Track {
    trackId: string;
    leaderBoardTitle?: string;
    leaderBoardFooter?: string;
    fleetId?: string;
}

// Race Configuration
export interface RaceConfig {
    raceType?: RaceTypeEnum;
    raceFormat?: RaceFormatEnum;
    raceEndCondition?: string;
    numberOfLaps?: number;
    rankingMethod?: string;
    trackType?: string;
    raceTimeInMin?: string;
    numberOfResetsPerLap?: string;
    maxRunsPerRacer?: string;
    averageLapsWindow?: string;
    resetPoints?: boolean;
    disableSpeedBoosts?: boolean;
}

// Leaderboard Configuration
export interface LeaderboardConfig {
    trackId: string;
    displayName: string;
    enableLeaderboard: boolean;
    numberOfRacesToAverage?: number;
}

// Landing Page Configuration
export interface LandingPageConfig {
    enableLandingPage: boolean;
    title?: string;
    description?: string;
    logoUrl?: string;
}

// Event interface
export interface Event {
    eventId: string;
    eventName: string;
    eventDate?: string;
    eventType?: EventTypeEnum;
    countryCode?: string;
    description?: string;
    tracks?: Track[];
    raceConfig?: RaceConfig;
    leaderboardConfig?: LeaderboardConfig[];
    landingPageConfig?: LandingPageConfig;
    fleetId?: string;
    fleetName?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

// Lap interface
export interface Lap {
    lapId: string;
    raceId: string;
    lapNumber: number;
    lapTime: number;
    lapTimeString?: string;
    isValid?: boolean;
    resetCount?: number;
    offTrackCount?: number;
    crashCount?: number;
    timestamp?: string;
}

// Race interface
export interface Race {
    raceId: string;
    eventId: string;
    trackId: string;
    userId: string;
    username?: string;
    raceType?: RaceTypeEnum;
    raceStatus?: RaceStatusEnum;
    numberOfLaps: number;
    laps?: Lap[];
    averageLapTime?: number;
    fastestLapTime?: number;
    totalRaceTime?: number;
    modelId?: string;
    modelName?: string;
    carId?: string;
    carName?: string;
    rank?: number;
    resetCount?: number;
    offTrackCount?: number;
    crashCount?: number;
    racedByProxy?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Car/Device interface
export interface Car {
    carId: string;
    InstanceId: string;
    ComputerName: string;
    IpAddress?: string;
    OperatingSystem?: string;
    PlatformName?: string;
    PlatformVersion?: string;
    Status?: DeviceStatusEnum;
    PingStatus?: 'Online' | 'Offline';
    Type?: string; // Car type: 'deepracer', etc.
    fleetId?: string;
    fleetName?: string;
    LoggingCapable?: boolean;
    modelIds?: string[];
    taillightColor?: string;
    lastSeen?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Fleet interface
export interface Fleet {
    fleetId: string;
    fleetName: string;
    description?: string;
    deviceIds?: string[];
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
}

// User interface
export interface User {
    userId: string;
    username: string;
    email?: string;
    role?: UserRoleEnum;
    groups?: string[];
    cognitoUsername?: string;
    enabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Model interface
export interface Model {
    modelId: string;
    modelName: string;
    modelname?: string; // Legacy alias for modelName
    username: string;
    modelKey?: string;
    fileMetaData?: {
        key: string;
        [key: string]: any;
    };
    description?: string;
    uploadStatus?: UploadStatusEnum;
    size?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Car Log Asset interface
export interface CarLogAsset {
    carLogId: string;
    assetId: string;
    username: string;
    carName?: string;
    eventId?: string;
    eventName?: string;
    status?: AssetStatusEnum;
    assetKey?: string;
    size?: number;
    downloadUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Leaderboard Entry interface
export interface LeaderboardEntry {
    userId: string;
    username: string;
    rank: number;
    averageLapTime: number;
    fastestLapTime: number;
    numberOfRaces: number;
    modelName?: string;
    countryCode?: string;
}

// Leaderboard interface
export interface Leaderboard {
    eventId: string;
    trackId: string;
    entries: LeaderboardEntry[];
    lastUpdated?: string;
}

// Upload to Car Status
export interface UploadToCarStatus {
    id: string;
    carId: string;
    carName?: string;
    modelId: string;
    modelName?: string;
    status: UploadStatusEnum;
    progress?: number;
    errorMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Fetch from Car Status
export interface FetchFromCarStatus {
    id: string;
    carId: string;
    carName?: string;
    eventId: string;
    eventName?: string;
    status: UploadStatusEnum;
    progress?: number;
    errorMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Group interface
export interface Group {
    groupId: string;
    groupName: string;
    description?: string;
    userCount?: number;
}

// Overlay Info interface
export interface OverlayInfo {
    eventId?: string;
    raceId?: string;
    data?: Record<string, unknown>;
}
