import { assign, createMachine, raise } from 'xstate';

interface TimekeeperContext {
  raceTimeIsExpired: boolean;
  dnf: boolean;
}

type TimekeeperEvent =
  | { type: 'TOGGLE' }
  | { type: 'END' }
  | { type: 'CAPTURE_LAP' }
  | { type: 'CAPTURE_AUT_LAP' }
  | { type: 'EXPIRE' }
  | { type: 'DID_NOT_FINISH' }
  | { type: 'RESUME' };

export const stateMachine = createMachine<TimekeeperContext, TimekeeperEvent>({
  id: 'timekeeper',
  predictableActionArguments: true,
  preserveActionOrder: true,
  context: { raceTimeIsExpired: false, dnf: false },
  initial: 'ReadyToStartRace',
  states: {
    ReadyToStartRace: {
      entry: ['readyToStart', 'publishReadyToStartOverlay'],
      on: {
        TOGGLE: 'RaceStarted',
        END: 'RaceIsOver',
        CAPTURE_AUT_LAP: 'RaceStarted',
      },
    },
    RaceStarted: {
      initial: 'running',
      states: {
        running: {
          entry: [
            'startTimer',
            'publishRaceInProgreessOverlay',
            assign({ raceTimeIsExpired: false }),
          ],
          on: {
            TOGGLE: 'paused',
            EXPIRE: {
              actions: [assign({ raceTimeIsExpired: true })],
            },
            END: 'raceIsOver',
            CAPTURE_LAP: 'captureLap',
            CAPTURE_AUT_LAP: 'captureLap',
            DID_NOT_FINISH: {
              actions: [assign({ dnf: true }), raise('CAPTURE_LAP')],
            },
          },
        },
        paused: {
          entry: ['pauseTimer', 'publishRacePausedOverlay'],
          on: {
            TOGGLE: 'running',
            CAPTURE_AUT_LAP: 'running',
            END: 'raceIsOver',
          },
        },
        captureLap: {
          entry: ['captureLap'],
          exit: [assign({ dnf: false })],
          always: [
            { target: 'running', cond: (context) => !context.raceTimeIsExpired && !context.dnf },
            { target: 'paused', cond: (context) => !context.raceTimeIsExpired && context.dnf },
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
      entry: ['pauseTimer', 'endRace', 'publishRacePausedOverlay'],
      on: {
        END: 'ReadyToStartRace',
        RESUME: 'RaceStarted.paused',
      },
    },
  },
});
