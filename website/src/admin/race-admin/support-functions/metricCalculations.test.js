import { calculateMetrics } from './metricCalculations';

describe('Race Manager', () => {
  describe('Metric Calculation', () => {
    test('race with no laps', () => {
      const noRaces = [];

      const raceMetrics = calculateMetrics(noRaces);

      // checking the entire object to ensure no parts are missing unit tests
      expect(raceMetrics).toEqual({
        numberOfRaces: null,
        numberOfUniqueRacers: null,
        mostNumberOfRacesByUser: null,
        avgRacesPerUser: null,
        totalLaps: null,
        totalresets: null,
        avgresestsPerLap: null,
        avgLapsPerRace: null,
        avgLapTime: null,
        fastestLap: null,
        slowestLap: null,
      });
    });

    describe('Total number of races', () => {
      test('for one race', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' }];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            numberOfRaces: 1,
          })
        );
      });

      test('for two races', () => {
        const twoRaces = [
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '222' },
        ];
        const raceMetrics = calculateMetrics(twoRaces);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            numberOfRaces: 2,
          })
        );
      });
    });

    describe('Number of unique racers', () => {
      test('for one racer', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' }];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            numberOfUniqueRacers: 1,
          })
        );
      });

      test('for multiple races by the same racer', () => {
        const twoRaces = [
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '222' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
        ];
        const raceMetrics = calculateMetrics(twoRaces);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            numberOfUniqueRacers: 2,
          })
        );
      });
    });

    describe('User with most races', () => {
      test('user with two races - three races in total', () => {
        const races = [
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '222' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            mostNumberOfRacesByUser: 2,
          })
        );
      });
    });

    describe('Avg races per user', () => {
      test('two races - different users', () => {
        const races = [
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '222' },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgRacesPerUser: '1.0',
          })
        );
      });

      test('three races - two with the same user', () => {
        const races = [
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '222' },
          { laps: [{ time: 1000, resets: 10, isValid: true }], userId: '111' },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgRacesPerUser: '1.5',
          })
        );
      });
    });

    describe('Total number of resets', () => {
      test('for one race with one lap', () => {
        const totalResets = 10;
        const singleRace = [{ laps: [{ time: 1000, resets: totalResets, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalresets: totalResets,
          })
        );
      });

      test('for one race with two laps', () => {
        const resetsLapOne = 10;
        const resetsLapTwo = 17;
        const totalResets = resetsLapOne + resetsLapTwo;
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: resetsLapOne, isValid: true },
              { time: 1000, resets: resetsLapTwo, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalresets: totalResets,
          })
        );
      });

      test('for two races', () => {
        const resetsRaceOneLapOne = 10;
        const resetsRaceOneLapTwo = 11;
        const resetsRaceTwoLapOne = 12;
        const resetsRaceTwoLapTwo = 13;
        const totalResets =
          resetsRaceOneLapOne + resetsRaceOneLapTwo + resetsRaceTwoLapOne + resetsRaceTwoLapTwo;
        const races = [
          {
            laps: [
              { time: 1000, resets: resetsRaceOneLapOne, isValid: true },
              { time: 1000, resets: resetsRaceOneLapTwo, isValid: true },
            ],
          },
          {
            laps: [
              { time: 1000, resets: resetsRaceTwoLapOne, isValid: true },
              { time: 1000, resets: resetsRaceTwoLapTwo, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalresets: totalResets,
          })
        );
      });
    });

    describe('Total number of laps', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalLaps: 1,
          })
        );
      });

      test('for one race with two laps', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalLaps: 2,
          })
        );
      });

      test('for two races', () => {
        const races = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);
        expect(raceMetrics).toEqual(
          expect.objectContaining({
            totalLaps: 4,
          })
        );
      });
    });

    describe('Avg resets per lap', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgresestsPerLap: '10.0',
          })
        );
      });

      test('for one race with two laps - interger', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 20, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgresestsPerLap: '15.0',
          })
        );
      });

      test('for one race with two laps - float', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 11, isValid: true },
              { time: 1000, resets: 22, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgresestsPerLap: '16.5',
          })
        );
      });

      test('for two races - integer', () => {
        const races = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 20, isValid: true },
            ],
          },
          {
            laps: [
              { time: 1000, resets: 30, isValid: true },
              { time: 1000, resets: 40, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgresestsPerLap: '25.0',
          })
        );
      });
    });

    describe('Avg Laps Per Race', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);
        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapsPerRace: '1.0',
          })
        );
      });

      test('for one race with two laps', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapsPerRace: '2.0',
          })
        );
      });

      test('for two races - integer', () => {
        const races = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapsPerRace: '2.0',
          })
        );
      });

      test('for two races - float', () => {
        const races = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [{ time: 1000, resets: 10, isValid: true }],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapsPerRace: '1.5',
          })
        );
      });
    });

    describe('Avg Laptime', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapTime: 1000,
          })
        );
      });

      test('for one race with two laps', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 3000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapTime: 2000,
          })
        );
      });

      test('for two races - integer', () => {
        const races = [
          {
            laps: [
              { time: 5000, resets: 10, isValid: true },
              { time: 3000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [
              { time: 3000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            avgLapTime: 3000,
          })
        );
      });
    });

    describe('Fastest Laptime', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 1000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            fastestLap: 1000,
          })
        );
      });

      test('for one race with two laps', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 600, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            fastestLap: 600,
          })
        );
      });

      test('for one race with two laps, one not valid', () => {
        const singleRace = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 600, resets: 10, isValid: false },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            fastestLap: 1000,
          })
        );
      });

      test('for two races - integer', () => {
        const races = [
          {
            laps: [
              { time: 2000, resets: 10, isValid: true },
              { time: 3000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [
              { time: 4000, resets: 10, isValid: true },
              { time: 900, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            fastestLap: 900,
          })
        );
      });
    });

    describe('Slowest Laptime', () => {
      test('for one race with one lap', () => {
        const singleRace = [{ laps: [{ time: 7000, resets: 10, isValid: true }] }];

        const raceMetrics = calculateMetrics(singleRace);
        expect(raceMetrics).toEqual(
          expect.objectContaining({
            slowestLap: 7000,
          })
        );
      });

      test('for one race with two laps', () => {
        const singleRace = [
          {
            laps: [
              { time: 5000, resets: 10, isValid: true },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            slowestLap: 5000,
          })
        );
      });

      test('for one race with two laps, one not valid', () => {
        const singleRace = [
          {
            laps: [
              { time: 5000, resets: 10, isValid: false },
              { time: 1000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(singleRace);

        expect(raceMetrics).toEqual(
          expect.objectContaining({
            slowestLap: 1000,
          })
        );
      });

      test('for two races - integer', () => {
        const races = [
          {
            laps: [
              { time: 1000, resets: 10, isValid: true },
              { time: 5000, resets: 10, isValid: true },
            ],
          },
          {
            laps: [
              { time: 6000, resets: 10, isValid: true },
              { time: 3000, resets: 10, isValid: true },
            ],
          },
        ];
        const raceMetrics = calculateMetrics(races);
        expect(raceMetrics).toEqual(
          expect.objectContaining({
            slowestLap: 6000,
          })
        );
      });
    });
  });
});
