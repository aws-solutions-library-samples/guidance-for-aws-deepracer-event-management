export const getAverageWindows = (laps, windowSize) => {
  if (!windowSize) {
    windowSize = 3;
  }

  const averageLapInformation = laps.reduce((acc, _, index, arr) => {
    if (index + windowSize > arr.length) return acc;

    const window = arr.slice(index, index + windowSize);

    if (window.every((lap) => lap.isValid)) {
      const avg = window.reduce((acc, curr) => acc + curr.time, 0) / windowSize;
      console.log(avg);
      acc = acc.concat({
        startLapId: window[0].lapId,
        endLapId: window[windowSize - 1].lapId,
        avgTime: Math.round(avg),
      });
    }
    return acc;
  }, []);

  console.debug(averageLapInformation);
  return averageLapInformation;
};
