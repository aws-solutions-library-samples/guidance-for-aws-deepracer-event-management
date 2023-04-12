import dayjs from 'dayjs';

var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export const dateTimeToString = (dateTime) => {
  return dayjs(dateTime).format('YYYY-MM-DD HH:mm:ss (z)');
};

/**
 * converts a number in milliseconds to human readable string
 * @param  {Number} timeInMS milliseconds to convert
 * @param  {Boolean} showMills true = mm:ss.SSS, false = mm:ss
 * @return {string} string representation
 */
export const convertMsToString = (timeInMS, showMills = true) => {
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
 * @param  {string} stringTime represented in mm:ss.SSS
 * @return {Number}
 */
export const convertStringToMs = (stringTime) => {
  const milliseconds = parseInt(stringTime.substring(6, 9));
  const secondsInMs = parseInt(stringTime.substring(3, 5)) * 1000;
  const minutesInMs = parseInt(stringTime.substring(0, 2)) * 60000;
  const sum = milliseconds + secondsInMs + minutesInMs;
  return sum;
};
