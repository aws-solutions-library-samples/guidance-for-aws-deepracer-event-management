import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        exclude: [
            // Pre-existing test files that need Jest→Vitest migration:
            // - raceTableConfig.test.ts uses jest.fn() (needs vi.fn())
            // - deviceTableConfig.test.ts needs jsdom environment + Amplify config
            'src/admin/race-admin/support-functions/raceTableConfig.test.ts',
            'src/components/devices-table/deviceTableConfig.test.ts',
        ],
        globals: true,
        environment: 'node',
    },
});
