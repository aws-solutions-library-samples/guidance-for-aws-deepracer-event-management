export const convertMsToString = (timeInMS) => {
  const millisecondsAsString = String(Math.floor(timeInMS % 1000)).padStart(3, '0');
  const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
  const seconds = Math.floor(timeInMS / 1000);
  const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
  const timeAsString = `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
  return timeAsString;
};
