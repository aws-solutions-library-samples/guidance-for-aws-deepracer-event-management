// GraphQL operation types and interfaces

import { Event, Race, Car, Fleet, User, Model, CarLogAsset } from './domain';

// GraphQL Operation input types

// Event inputs
export interface CreateEventInput {
  eventName: string;
  eventType?: string;
  countryCode?: string;
  description?: string;
  tracks?: unknown[];
  raceConfig?: unknown;
  leaderboardConfig?: unknown[];
  landingPageConfig?: unknown;
  fleetId?: string;
  fleetName?: string;
}

export interface UpdateEventInput {
  eventId: string;
  eventName?: string;
  eventType?: string;
  countryCode?: string;
  description?: string;
  tracks?: unknown[];
  raceConfig?: unknown;
  leaderboardConfig?: unknown[];
  landingPageConfig?: unknown;
  fleetId?: string;
  fleetName?: string;
}

export interface DeleteEventInput {
  eventIds: string[];
}

// Race inputs
export interface CreateRaceInput {
  eventId: string;
  trackId: string;
  userId: string;
  username?: string;
  raceType?: string;
  numberOfLaps: number;
  modelId?: string;
  modelName?: string;
  carId?: string;
  carName?: string;
}

export interface UpdateRaceInput {
  raceId: string;
  raceStatus?: string;
  laps?: unknown[];
  averageLapTime?: number;
  fastestLapTime?: number;
  totalRaceTime?: number;
  resetCount?: number;
  offTrackCount?: number;
  crashCount?: number;
}

export interface DeleteRaceInput {
  raceIds: string[];
}

// Car inputs
export interface CreateCarInput {
  carId: string;
  carName: string;
  fleetId?: string;
  fleetName?: string;
}

export interface UpdateCarInput {
  carId: string;
  carName?: string;
  fleetId?: string;
  fleetName?: string;
  taillightColor?: string;
}

export interface DeleteCarInput {
  carId: string;
}

// Fleet inputs
export interface CreateFleetInput {
  fleetName: string;
  description?: string;
  deviceIds?: string[];
}

export interface UpdateFleetInput {
  fleetId: string;
  fleetName?: string;
  description?: string;
  deviceIds?: string[];
}

export interface DeleteFleetsInput {
  fleetIds: string[];
}

// User inputs
export interface CreateUserInput {
  username: string;
  email: string;
  role?: string;
  groups?: string[];
  enabled?: boolean;
}

export interface UpdateUserInput {
  userId: string;
  email?: string;
  role?: string;
  groups?: string[];
  enabled?: boolean;
}

export interface DeleteUserInput {
  userId: string;
}

// Model inputs
export interface CreateModelInput {
  modelName: string;
  username: string;
  modelKey?: string;
  description?: string;
}

export interface UpdateModelInput {
  modelId: string;
  modelName?: string;
  description?: string;
  uploadStatus?: string;
}

export interface DeleteModelInput {
  modelId: string;
}

// Car log inputs
export interface CreateCarLogInput {
  username: string;
  carName?: string;
  eventId?: string;
  eventName?: string;
  assetKey?: string;
}

export interface UpdateCarLogInput {
  carLogId: string;
  status?: string;
  downloadUrl?: string;
}

export interface DeleteCarLogInput {
  carLogId: string;
}

// Upload to car inputs
export interface UploadModelToCarInput {
  carId: string;
  modelId: string;
}

export interface CarDeleteAllModelsInput {
  resourceIds: string[];
  withSystemLogs?: boolean;
}

export interface StartUploadToCarInput {
  carId: string;
  modelId: string;
}

// Fetch from car inputs
export interface StartFetchFromCarInput {
  carInstanceId: string;
  carName: string;
  carFleetId?: string;
  carFleetName?: string;
  carIpAddress?: string;
  eventId: string;
  eventName: string;
  laterThan?: string;
  racerName?: string;
  raceData?: string;
}

// Device activation input
export interface DeviceActivationInput {
  instanceId: string;
  action: string;
}

// GraphQL subscription payloads
export interface SubscriptionPayload<T> {
  value: {
    data: T;
  };
}

// Specific subscription payloads
export interface OnAddedEventPayload {
  onAddedEvent: Event;
}

export interface OnUpdatedEventPayload {
  onUpdatedEvent: Event;
}

export interface OnDeletedEventsPayload {
  onDeletedEvents: string[];
}

export interface OnAddedRacePayload {
  onAddedRace: Race;
}

export interface OnUpdatedRacePayload {
  onUpdatedRace: Race;
}

export interface OnDeletedRacesPayload {
  onDeletedRaces: string[];
}

export interface OnAddedFleetPayload {
  onAddedFleet: Fleet;
}

export interface OnUpdatedFleetPayload {
  onUpdatedFleet: Fleet;
}

export interface OnDeletedFleetsPayload {
  onDeletedFleets: string[];
}

export interface OnAddedModelPayload {
  onAddedModel: Model;
}

export interface OnUpdatedModelPayload {
  onUpdatedModel: Model;
}

export interface OnDeletedModelPayload {
  onDeletedModel: Model;
}

export interface OnAddedCarLogsAssetPayload {
  onAddedCarLogsAsset: CarLogAsset;
}

export interface OnDeletedCarLogsAssetPayload {
  onDeletedCarLogsAsset: CarLogAsset;
}

export interface OnUpdatedCarsInfoPayload {
  onUpdatedCarsInfo: Car[];
}

export interface OnUserCreatedPayload {
  onUserCreated: User;
}

export interface OnUserUpdatedPayload {
  onUserUpdated: User;
}

export interface OnNewLeaderboardEntryPayload {
  onNewLeaderboardEntry: {
    eventId: string;
    leaderboard: unknown;
  };
}

export interface OnNewOverlayInfoPayload {
  onNewOverlayInfo: {
    overlayInfo: unknown;
  };
}

// Query variable types
export interface GetEventVariables {
  eventId: string;
}

export interface GetRaceVariables {
  raceId: string;
}

export interface GetRacesVariables {
  eventId: string;
}

export interface GetLeaderboardVariables {
  eventId: string;
  trackId?: string;
}

export interface GetCarVariables {
  carId: string;
}

export interface ListCarsVariables {
  online?: boolean;
}

export interface GetFleetVariables {
  fleetId: string;
}

export interface GetModelVariables {
  modelId: string;
}

export interface GetCarLogVariables {
  carLogId: string;
}

export interface GetUploadModelToCarStatusVariables {
  id: string;
}

export interface CarPrintableLabelVariables {
  instanceId: string;
}
