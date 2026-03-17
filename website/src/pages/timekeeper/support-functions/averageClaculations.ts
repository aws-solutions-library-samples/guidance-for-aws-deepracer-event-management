interface Lap {
  lapId: number;
  time: number;
  isValid: boolean;
}

interface AverageLapWindow {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

export const getAverageWindows = (laps: Lap[], windowSize?: number): AverageLapWindow[] => {
  if (!windowSize) {
    windowSize = 3;
  }

  const averageLapInformation: AverageLapWindow[] = laps.reduce((acc: AverageLapWindow[], _, index: number, arr: Lap[]) => {
    if (index + windowSize! > arr.length) return acc;

    const window: Lap[] = arr.slice(index, index + windowSize!);

    if (window.every((lap) => lap.isValid)) {
      const avg: number = window.reduce((sum, curr) => sum + curr.time, 0) / windowSize!;
      console.log(avg);
      acc = acc.concat({
        startLapId: window[0].lapId,
        endLapId: window[windowSize! - 1].lapId,
        avgTime: Math.round(avg),
      });
    }
    return acc;
  }, []);

  console.debug(averageLapInformation);
  return averageLapInformation;
};
