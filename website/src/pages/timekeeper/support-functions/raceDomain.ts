interface Lap {
  lapId: string | null;
  time: number;
  resets: number;
  isValid: boolean;
  autTimerConnected: boolean;
  carName: string;
}

interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

interface Race {
  eventId: string | null;
  userId: string | null;
  username: string | null;
  laps: Lap[];
  averageLaps: AverageLap[];
  trackId: number;
  racedByProxy: boolean;
}

interface Car {
  ComputerName: string;
}

export const defaultRace: Race = {
  eventId: null,
  userId: null,
  username: null,
  laps: [],
  averageLaps: [],
  trackId: 1,
  racedByProxy: false,
};

export const defaultLap: Lap = {
  lapId: null,
  time: 0,
  resets: 0,
  isValid: false,
  autTimerConnected: false,
  carName: '',
};

export const defaultCar: Car = {
  ComputerName: 'Default',
};
