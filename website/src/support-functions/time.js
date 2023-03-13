export const convertMsToString = (timeInMS) => {
  const millisecondsAsString = String(timeInMS).slice(-3).padStart(3, '0');
  const seconds = Math.floor(timeInMS / 1000);
  const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
  const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
  return `${minutesAsString}:${secondsAsString}.${millisecondsAsString}`;
};

export const convertStringToMs = (stringTime) => {
  const milliseconds = parseInt(stringTime.substring(6, 9));
  console.info(milliseconds);
  const secondsInMs = parseInt(stringTime.substring(3, 5)) * 1000;
  console.info(secondsInMs);
  const minutesInMs = parseInt(stringTime.substring(0, 2)) * 60000;
  console.info(minutesInMs);
  const sum = milliseconds + secondsInMs + minutesInMs;
  console.info(sum);
  return sum;
};
