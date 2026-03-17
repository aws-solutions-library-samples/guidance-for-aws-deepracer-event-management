// API response types and interfaces

import { Event, Race, Car, Fleet, User, Model, CarLogAsset, Leaderboard, UploadToCarStatus, FetchFromCarStatus, Group } from './domain';

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  errors?: ApiError[];
}

// API Error interface
export interface ApiError {
  message: string;
  errorType?: string;
  errorInfo?: string;
  path?: string[];
  locations?: ErrorLocation[];
}

export interface ErrorLocation {
  line: number;
  column: number;
}

// List response wrapper
export interface ListResponse<T> {
  items: T[];
  nextToken?: string;
}

// Specific API response types
export interface EventsResponse {
  listEvents?: ListResponse<Event>;
  getEvent?: Event;
}

export interface RacesResponse {
  getRaces?: ListResponse<Race>;
  getRace?: Race;
}

export interface CarsResponse {
  listCars?: Car[];
  getCar?: Car;
}

export interface FleetsResponse {
  getAllFleets?: ListResponse<Fleet>;
  getFleet?: Fleet;
}

export interface UsersResponse {
  listUsers?: ListResponse<User>;
  getUser?: User;
}

export interface ModelsResponse {
  getAllModels?: ListResponse<Model>;
  getModel?: Model;
  listModels?: ListResponse<Model>;
}

export interface CarLogsResponse {
  getAllCarLogsAssets?: ListResponse<CarLogAsset>;
  getCarLog?: CarLogAsset;
  listCarLogs?: ListResponse<CarLogAsset>;
}

export interface LeaderboardResponse {
  getLeaderboard?: Leaderboard;
}

export interface UploadToCarStatusResponse {
  listUploadsToCar?: ListResponse<UploadToCarStatus>;
  getUploadModelToCarStatus?: UploadToCarStatus;
}

export interface FetchFromCarStatusResponse {
  listFetchesFromCar?: ListResponse<FetchFromCarStatus>;
}

export interface GroupsResponse {
  listGroups?: ListResponse<Group>;
}

// Mutation response types
export interface MutationResponse {
  success?: boolean;
  message?: string;
}

export interface CreateResponse<T> {
  [key: string]: T;
}

export interface UpdateResponse<T> {
  [key: string]: T;
}

export interface DeleteResponse {
  [key: string]: string | string[];
}

// Device activation response
export interface DeviceActivationResponse {
  success: boolean;
  message?: string;
}

// Taillight colors response
export interface TaillightColorsResponse {
  availableTaillightColors?: {
    colors: string[];
  };
}

// Car printable label response
export interface CarPrintableLabelResponse {
  carPrintableLabel?: string;
}
