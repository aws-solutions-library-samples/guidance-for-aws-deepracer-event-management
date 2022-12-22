import { assign, createMachine } from 'xstate';

export const stateMachine = createMachine({
  id: 'timekeeper',
  predictableActionArguments: true,
  preserveActionOrder: true,
  context: { raceTimeIsExpired: false },
  initial: 'RaceReseted',
  states: {
    RaceReseted: {
      entry: ['resetRace'],
      on: {
        READY: 'ReadyToStartRace',
        END: 'RaceReseted',
      },
    },
    ReadyToStartRace: {
      entry: ['readyToStart', 'startPublishOverlayInfo'],
      on: {
        TOGGLE: 'RaceStarted',
        END: 'RaceReseted',
      },
    },
    RaceStarted: {
      initial: 'running',
      states: {
        running: {
          entry: ['startTimer', assign({ raceTimeIsExpired: false })],
          on: {
            TOGGLE: 'paused',
            EXPIRE: {
              actions: [assign({ raceTimeIsExpired: true })],
            },
            END: 'raceIsOver',
            CAPTURE_LAP: 'captureLap',
          },
        },
        paused: {
          entry: ['pauseTimer'],
          on: {
            TOGGLE: 'running',
            END: 'raceIsOver',
          },
        },
        captureLap: {
          entry: ['captureLap'],
          always: [
            { target: 'running', cond: (context) => !context.raceTimeIsExpired },
            { target: 'raceIsOver', cond: (context) => context.raceTimeIsExpired },
          ],
        },
        raceIsOver: {
          type: 'final',
        },
      },
      onDone: 'RaceIsOver',
    },
    RaceIsOver: {
      entry: ['pauseTimer', 'stopPublishOverlayInfo', 'endRace'],
      on: {
        END: 'RaceReseted',
      },
    },
  },
});
