// API Response Types - Generated from CDK GraphQL Schema Definitions
// These types match the actual API responses from the backend Lambda functions
//
// IMPORTANT NOTE: 
// This file contains types derived from the CDK GraphQL schema (source of truth for API responses).
// There is a separate file `types/domain.ts` that contains frontend domain model types.
// 
// Key Differences:
// - api-responses.ts: Types as they come FROM the API (backend shape)
// - domain.ts: Types as used IN the application (frontend shape)
//
// Some fields may differ in type between the two (e.g., numbers vs strings for IDs/times)
// This is intentional - the frontend may transform API responses into domain models.
//
// Usage:
// 1. Use api-responses types for API.graphql() call responses
// 2. Use domain types for component state and props
// 3. Transform API responses to domain models in your API layer/hooks

// ============================================================================
// EVENT API TYPES
// ============================================================================

export enum TrackType {
  REINVENT_2018 = 'REINVENT_2018',
  REINVENT_2019 = 'REINVENT_2019',
  REINVENT_2022 = 'REINVENT_2022',
  REINVENT_2023 = 'REINVENT_2023',
  FOREVER_RACEWAY = 'FOREVER_RACEWAY',
  SUMMIT_SPEEDWAY = 'SUMMIT_SPEEDWAY',
  ATOZ_SPEEDWAY = 'ATOZ_SPEEDWAY',
  OTHER = 'OTHER',
}

export enum RankingMethod {
  BEST_LAP_TIME = 'BEST_LAP_TIME',
  BEST_AVERAGE_LAP_TIME_X_LAP = 'BEST_AVERAGE_LAP_TIME_X_LAP',
}

export enum TypeOfEvent {
  PRIVATE_WORKSHOP = 'PRIVATE_WORKSHOP',
  PRIVATE_TRACK_RACE = 'PRIVATE_TRACK_RACE',
  OFFICIAL_WORKSHOP = 'OFFICIAL_WORKSHOP',
  OFFICIAL_TRACK_RACE = 'OFFICIAL_TRACK_RACE',
  OTHER = 'OTHER',
}

export interface RaceConfig {
  raceTimeInMin: number;
  numberOfResetsPerLap: number;
  trackType: TrackType;
  rankingMethod: RankingMethod;
  maxRunsPerRacer: string;
  averageLapsWindow: number;
}

export interface Track {
  trackId: string;
  fleetId?: string;
  leaderBoardTitle: string;
  leaderBoardFooter: string;
}

export interface LandingPageConfig {
  leaderBoardTitle?: string;
  leaderBoardFooter?: string;
  sponsor?: string;
  [key: string]: any; // Additional landing page configuration properties
}

export interface Event {
  eventId: string;
  createdAt: string; // AWSDateTime format
  createdBy: string;
  eventName: string;
  typeOfEvent: TypeOfEvent;
  eventDate: string; // AWSDate format (YYYY-MM-DD)
  sponsor: string;
  countryCode: string;
  raceConfig: RaceConfig;
  tracks: Track[];
  landingPageConfig?: LandingPageConfig;
}

// API Response for getEvents query
export interface GetEventsResponse {
  data: {
    getEvents: Event[];
  };
}

// API Response for addEvent mutation
export interface AddEventResponse {
  data: {
    addEvent: Event;
  };
}

// API Response for updateEvent mutation
export interface UpdateEventResponse {
  data: {
    updateEvent: Event;
  };
}

// API Response for deleteEvents mutation
export interface DeleteEventsResponse {
  data: {
    deleteEvents: Array<{ eventId: string }>;
  };
}

// ============================================================================
// LEADERBOARD API TYPES
// ============================================================================

export interface LeaderboardAverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

export interface LeaderboardEntry {
  eventId: string;
  trackId: string;
  username: string;
  racedByProxy: boolean;
  numberOfValidLaps?: number;
  numberOfInvalidLaps?: number;
  fastestLapTime?: number;
  fastestAverageLap?: LeaderboardAverageLap;
  avgLapTime?: number;
  lapCompletionRatio?: number;
  avgLapsPerAttempt?: number;
  countryCode?: string;
  mostConcecutiveLaps?: number;
}

export interface LeaderboardConfig {
  leaderBoardTitle: string;
  leaderBoardFooter: string;
  sponsor?: string;
}

export interface Leaderboard {
  config: LeaderboardConfig;
  entries: LeaderboardEntry[];
}

// API Response for getLeaderboard query
export interface GetLeaderboardResponse {
  data: {
    getLeaderboard: Leaderboard;
  };
}

// ============================================================================
// RACE API TYPES
// ============================================================================

export interface Lap {
  lapId: string;
  time: number;
  resets?: number;
  isValid: boolean;
  autTimerConnected?: boolean;
  carName?: string;
}

export interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

export interface Race {
  eventId: string;
  trackId: string;
  userId: string;
  racedByProxy: boolean;
  raceId: string;
  createdAt: string; // AWSDateTime format
  laps?: Lap[];
  averageLaps?: AverageLap[];
}

// API Response for getRaces query
export interface GetRacesResponse {
  data: {
    getRaces: Race[];
  };
}

// API Response for addRace mutation
export interface AddRaceResponse {
  data: {
    addRace: Race;
  };
}

// API Response for updateRace mutation
export interface UpdateRaceResponse {
  data: {
    updateRace: Race;
  };
}

// API Response for deleteRaces mutation
export interface DeleteRacesResponse {
  data: {
    deleteRaces: {
      eventId: string;
      raceIds: string[];
    };
  };
}

// ============================================================================
// MODELS API TYPES
// ============================================================================

export interface ModelFileMetadata {
  uploadedDateTime: string;
  fileName: string;
  fileSize?: number;
  [key: string]: any;
}

export interface Model {
  modelId: string;
  sub: string;
  modelName: string;
  status: 'UPLOADED' | 'AVAILABLE' | 'NOT_VALID' | 'OPTIMIZED' | 'QUARANTINED';
  fileMetaData: ModelFileMetadata;
  optimizedUrl?: string;
  modelMetadata?: {
    sensor?: string;
    actionSpace?: string;
    trainingAlgorithm?: string;
    [key: string]: any;
  };
}

export interface GetAllModelsResponse {
  data: {
    getAllModels: {
      models: Model[];
      nextToken?: string;
    };
  };
}

// ============================================================================
// USERS API TYPES
// ============================================================================

export interface User {
  Username: string;
  sub: string;
  Attributes?: Array<{
    Name: string;
    Value: string;
  }>;
  UserCreateDate?: string;
  UserLastModifiedDate?: string;
  Enabled?: boolean;
  UserStatus?: string;
}

export interface GetUsersResponse {
  data: {
    getUsers: {
      users: User[];
      nextToken?: string;
    };
  };
}

// ============================================================================
// CARS/FLEETS API TYPES  
// ============================================================================

export interface Car {
  carId: string;
  carName: string;
  carStatus: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
  instanceId?: string;
  deviceId?: string;
  batteryLevel?: number;
  fleetId?: string;
}

export interface Fleet {
  fleetId: string;
  fleetName: string;
  fleetDescription?: string;
  cars?: Car[];
}

export interface GetCarsResponse {
  data: {
    getCars: Car[];
  };
}

export interface GetFleetsResponse {
  data: {
    getFleets: Fleet[];
  };
}

// ============================================================================
// GENERIC API RESPONSE WRAPPER
// ============================================================================

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: {
    code?: string;
    [key: string]: any;
  };
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

// Helper type for API.graphql() calls
export type APIGraphQLResult<T> = Promise<{
  data?: T;
  errors?: GraphQLError[];
}>;

// ============================================================================
// INPUT TYPES FOR MUTATIONS
// ============================================================================

export interface AddEventInput {
  eventName: string;
  typeOfEvent: TypeOfEvent;
  tracks: Array<{
    trackId: string;
    fleetId?: string;
    leaderBoardTitle: string;
    leaderBoardFooter: string;
  }>;
  eventDate?: string;
  sponsor?: string;
  countryCode?: string;
  raceConfig: {
    raceTimeInMin: number;
    numberOfResetsPerLap: number;
    trackType: TrackType;
    rankingMethod: RankingMethod;
    maxRunsPerRacer: string;
    averageLapsWindow: number;
  };
  landingPageConfig?: LandingPageConfig;
}

export interface UpdateEventInput {
  eventId: string;
  eventName?: string;
  typeOfEvent?: TypeOfEvent;
  tracks?: Array<{
    trackId: string;
    fleetId?: string;
    leaderBoardTitle: string;
    leaderBoardFooter: string;
  }>;
  eventDate?: string;
  sponsor?: string;
  countryCode?: string;
  raceConfig?: Partial<RaceConfig>;
  landingPageConfig?: LandingPageConfig;
}

export interface AddRaceInput {
  eventId: string;
  trackId: string;
  userId: string;
  racedByProxy: boolean;
  laps: Array<{
    lapId: string;
    time: number;
    resets?: number;
    isValid: boolean;
    autTimerConnected?: boolean;
    carName?: string;
  }>;
  averageLaps?: Array<{
    startLapId: number;
    endLapId: number;
    avgTime: number;
  }>;
}

export interface UpdateRaceInput extends AddRaceInput {
  raceId: string;
}
