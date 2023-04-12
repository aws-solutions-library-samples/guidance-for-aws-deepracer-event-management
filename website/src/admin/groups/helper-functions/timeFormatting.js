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
