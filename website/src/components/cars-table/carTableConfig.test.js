import i18next from '../../i18n';
import { ColumnsConfig, VisibleContentOptions } from './carTableConfig';

i18next.t = jest.fn().mockReturnValue('');

describe('Cars Table', () => {
  describe('Cars table config', () => {
    test('ensure same columns configured in both configs', () => {
      const columnDefinitions = ColumnsConfig();
      const cdIds = columnDefinitions.map((o) => o.id);

      const visibleContentOptions = VisibleContentOptions();
      const vcoIds = visibleContentOptions[0].options.map((o) => o.id);

      expect(cdIds.sort()).toEqual(vcoIds.sort());
    });
  });
});
