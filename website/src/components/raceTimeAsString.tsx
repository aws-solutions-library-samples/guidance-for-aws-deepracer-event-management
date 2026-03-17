import { convertMsToString } from '../support-functions/time';

/**
 * Props interface for RaceTimeAsString component
 */
interface RaceTimeAsStringProps {
  /** Time in milliseconds */
  timeInMS: number | null | undefined;
  /** Whether to show milliseconds in the output (default: true) */
  showMills?: boolean;
}

/**
 * RaceTimeAsString component that displays race time in formatted string
 * @param props - Component props
 * @returns Formatted time string or '-' if no time provided
 */
const RaceTimeAsString = ({ timeInMS, showMills = true }: RaceTimeAsStringProps): JSX.Element => {
  return <>{timeInMS ? convertMsToString(timeInMS, showMills) : '-'}</>;
};

export { RaceTimeAsString };
