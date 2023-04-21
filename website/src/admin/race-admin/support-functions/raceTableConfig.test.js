import i18next from '../../../i18n';
import { ColumnDefinitions, VisibleContentOptions } from './raceTableConfig';

i18next.t = jest.fn().mockReturnValue('');

describe('Race Manager', () => {
  describe('Race table config', () => {
    test('ensure same columns configured in both configs', () => {
      const columnDefinitions = ColumnDefinitions();
      const cdIds = columnDefinitions.map((o) => o.id);

      const visibleContentOptions = VisibleContentOptions();
      const vcoIds = visibleContentOptions[0].options.map((o) => o.id);

      expect(cdIds.sort()).toEqual(vcoIds.sort());
    });
  });
});
