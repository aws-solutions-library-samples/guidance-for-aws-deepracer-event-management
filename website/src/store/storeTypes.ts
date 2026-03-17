// Global store state types
import { Event, Model, Car, Fleet, CarLogAsset, Race } from '../types/domain';
import { User } from '../types/api-responses';

// Events state
export interface EventsState {
  events: Event[];
  isLoading: boolean;
}

// Users state
export interface UsersState {
  users: User[];
  isLoading: boolean;
}

// Models state
export interface ModelsState {
  models: Model[];
  isLoading: boolean;
}

// Cars/Devices state
export interface DevicesState {
  devices: Car[];
  isLoading: boolean;
}

// Fleets state
export interface FleetsState {
  fleets: Fleet[];
  isLoading: boolean;
}

// Assets state
export interface AssetsState {
  assets: CarLogAsset[];
  isLoading: boolean;
}

// Cars state
export interface CarsState {
  cars: Car[];
  isLoading: boolean;
  refresh: boolean;
  offlineCars: boolean;
}

// Races state
export interface RacesState {
  races: Race[];
  isLoading: boolean;
}

// UI state for side navigation
export interface SideNavState {
  isOpen: boolean;
}

// UI state for split panel
export interface SplitPanelState {
  isOpen?: boolean;
  content?: React.ReactNode;
}

// UI state for help panel
export interface HelpPanelState {
  isOpen?: boolean;
  isHidden?: boolean;
  content?: React.ReactNode;
}

// Notification state
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  header: string;
  content?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export interface NotificationsState {
  notifications: Notification[];
}

// Complete global state interface
export interface GlobalState {
  events?: EventsState;
  users?: UsersState;
  models?: ModelsState;
  devices?: DevicesState;
  cars?: CarsState;
  races?: RacesState;
  fleets?: FleetsState;
  assets?: AssetsState;
  sideNav?: SideNavState;
  splitPanel?: SplitPanelState;
  helpPanel?: HelpPanelState;
  notifications?: NotificationsState;
}

// Action type definitions using discriminated union pattern
export type StoreAction =
  | { type: 'ADD_EVENTS'; payload: Event[] }
  | { type: 'UPDATE_EVENT'; payload: Event }
  | { type: 'DELETE_EVENTS'; payload: string[] }
  | { type: 'EVENTS_IS_LOADING'; payload: boolean }
  | { type: 'ADD_USERS'; payload: User[] }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USERS'; payload: string[] }
  | { type: 'USERS_IS_LOADING'; payload: boolean }
  | { type: 'ADD_MODELS'; payload: Model[] }
  | { type: 'MODELS_IS_LOADING'; payload: boolean }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'TOGGLE_SIDE_NAV' }
  | { type: 'TOGGLE_SPLIT_PANEL'; payload?: React.ReactNode }
  | { type: 'TOGGLE_HELP_PANEL'; payload?: React.ReactNode };
