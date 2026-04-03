import i18next from '../../i18n';

vi.mock('@cloudscape-design/components', () => ({
  Checkbox: vi.fn(),
  FormField: vi.fn(),
  Link: vi.fn(),
}));

vi.mock('@cloudscape-design/components/button-dropdown', () => ({ default: vi.fn() }));
vi.mock('@cloudscape-design/components/date-picker', () => ({ default: vi.fn() }));

vi.mock('aws-amplify', () => ({
  API: {
    graphql: vi.fn(),
  },
}));

vi.mock('../../store/contexts/storeProvider', () => ({
  useSelectedEventContext: vi.fn(),
}));

vi.mock('../../hooks/useCarsApi', () => ({
  useCarCmdApi: vi.fn(),
}));

// eslint-disable-next-line import/first
import { ColumnsConfig, VisibleContentOptions } from './deviceTableConfig';

// Mock i18next with proper typing
const mockT = vi.fn().mockReturnValue('') as any;
i18next.t = mockT;

describe('Devices Table', () => {
  describe('Devices table config', () => {
    test('ensure same columns configured in both configs', () => {
      const columnDefinitions = ColumnsConfig();
      const cdIds = columnDefinitions.map((o) => o.id);

      const visibleContentOptions = VisibleContentOptions();
      const vcoIds = visibleContentOptions[0].options.map((o) => o.id);

      expect(cdIds.sort()).toEqual(vcoIds.sort());
    });
  });
});
