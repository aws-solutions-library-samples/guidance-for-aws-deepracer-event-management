import { convertMsToString, convertStringToMs } from './time';

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

    test('convert ms to string without ms', () => {
      const stringTime = convertMsToString(1111111, false);

      expect(stringTime).toEqual('18:31');
    });

    test('convert string to ms with 0', () => {
      const stringTime = convertStringToMs('00:00.000');

      expect(stringTime).toEqual(0);
    });

    test('convert string to ms', () => {
      const stringTime = convertStringToMs('12:34.567');

      expect(stringTime).toEqual(754567);
    });
  });
});
