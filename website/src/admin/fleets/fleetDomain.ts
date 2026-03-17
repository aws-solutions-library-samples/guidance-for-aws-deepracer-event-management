import { Fleet } from '../../types/domain';

/**
 * Fleet configuration type that includes legacy carIds property
 * Maps to Fleet.deviceIds in the domain model
 */
export interface FleetConfig extends Omit<Fleet, 'deviceIds'> {
  carIds?: string[];
}

/**
 * Default fleet object with empty values for creating new fleets
 */
export const fleet: Partial<FleetConfig> = {
  fleetId: undefined,
  fleetName: undefined,
  carIds: [],
  createdBy: undefined,
};
