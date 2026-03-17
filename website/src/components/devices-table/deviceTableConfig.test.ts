import i18next from '../../i18n';

// Mock @cloudscape-design/components to avoid ES module issues in Jest
jest.mock('@cloudscape-design/components', () => ({
  Checkbox: jest.fn(),
  FormField: jest.fn(),
  Link: jest.fn(),
}));

jest.mock('@cloudscape-design/components/button-dropdown', () => jest.fn());
jest.mock('@cloudscape-design/components/date-picker', () => jest.fn());

// Mock aws-amplify to avoid axios ES module issues
jest.mock('aws-amplify', () => ({
  API: {
    graphql: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import { ColumnsConfig, VisibleContentOptions } from './deviceTableConfig';

// Mock i18next with proper typing
const mockT = jest.fn().mockReturnValue('') as any;
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
