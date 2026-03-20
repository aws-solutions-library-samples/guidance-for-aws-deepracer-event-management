import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        exclude: [
            'src/admin/race-admin/support-functions/raceTableConfig.test.ts',
            'src/components/devices-table/deviceTableConfig.test.ts',
        ],
        globals: true,
        environment: 'node',
        reporters: ['default', ['junit', { outputFile: '../reports/junit-website.xml' }]],
    },
});
