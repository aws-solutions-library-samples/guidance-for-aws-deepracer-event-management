interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

interface OverlayInfo {
  averageLaps?: AverageLap[];
}

export const getFacestAvgFromOverlayInfo = (overlayInfo: OverlayInfo): AverageLap | Record<string, never> => {
  let lapsSortedByAvgTime: AverageLap[] = [];

  if (overlayInfo.averageLaps && overlayInfo.averageLaps.length > 0) {
    lapsSortedByAvgTime = overlayInfo.averageLaps.sort((a, b) => {
      return a.avgTime > b.avgTime ? 1 : b.avgTime > a.avgTime ? -1 : 0;
    });
    return lapsSortedByAvgTime[0];
  }
  return {};
};
