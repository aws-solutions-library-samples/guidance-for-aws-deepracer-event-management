import { convertMsToString } from './time';

describe('Support functions', () => {
  describe('Time', () => {
    test('convert ms to string with ms - 0', () => {
      const stringTime = convertMsToString(0);

      expect(stringTime).toEqual('00:00.000');
    });

    test('convert ms to string with ms', () => {
      const stringTime = convertMsToString(1111111);

      expect(stringTime).toEqual('18:31.111');
    });
  });
});
