import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        exclude: [
            'src/__tests__/graphql-schema-conformance.test.ts',
            'src/__tests__/smoke.test.ts',
        ],
        globals: true,
        environment: 'node',
        reporters: ['default', ['junit', { outputFile: '../reports/junit-website.xml' }]],
    },
});
