export const getFacestAvgFromOverlayInfo = (overlayInfo) => {
  var lapsSortedByAvgTime = [];

  var fastestRaceAvg = {};
  if (overlayInfo.averageLaps && overlayInfo.averageLaps.length > 0) {
    lapsSortedByAvgTime = overlayInfo.averageLaps.sort((a, b) => {
      return a.avgTime > b.avgTime ? 1 : b.avgTime > a.avgTime ? -1 : 0;
    });
    fastestRaceAvg = lapsSortedByAvgTime[0];
  }
  return fastestRaceAvg;
};
