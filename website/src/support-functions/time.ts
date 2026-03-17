import dayjs, { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/**
 * converts an an AWSDateTime to a more human readable string
 * @param  dateTime An extended ISO 8601 date and time string in the format YYYY-MM-DDThh:mm:ss.sssZ.
 * @return string representation YYYY-MM-DD HH:mm:ss (z)
 */
export const formatAwsDateTime = (dateTime: string | undefined): string | undefined => {
  if (!dateTime) return undefined;
  const result = dayjs(dateTime).format('YYYY-MM-DD HH:mm:ss (z)');
  if (result === 'Invalid Date') {
    return undefined;
  } else {
    return result;
  }
};

/**
 * converts a number in milliseconds to human readable string
 * @param  timeInMS milliseconds to convert
 * @param  showMills true = mm:ss.SSS, false = mm:ss
 * @return string representation
 */
export const convertMsToString = (timeInMS: number, showMills: boolean = true): string => {
  const millisecondsAsString = String(timeInMS).slice(-3).padStart(3, '0');
  const seconds = Math.floor(timeInMS / 1000);
  const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
  const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');

  let timeAsString = `${minutesAsString}:${secondsAsString}`;
  if (showMills) timeAsString = timeAsString + `.${millisecondsAsString}`;
  return timeAsString;
};

/**
 * converts a string in mm:ss.SSS format to a millisecond number
 * @param  stringTime represented in mm:ss.SSS
 * @return milliseconds as number
 */
export const convertStringToMs = (stringTime: string): number => {
  const milliseconds = parseInt(stringTime.substring(6, 9));
  const secondsInMs = parseInt(stringTime.substring(3, 5)) * 1000;
  const minutesInMs = parseInt(stringTime.substring(0, 2)) * 60000;
  const sum = milliseconds + secondsInMs + minutesInMs;
  return sum;
};

/** returns a date */
export const getCurrentDateTime = (): Dayjs => {
  return dayjs();
};
