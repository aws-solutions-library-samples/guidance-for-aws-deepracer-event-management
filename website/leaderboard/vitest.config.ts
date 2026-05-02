import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: [
      '**/node_modules/**',
      'src/App.test.tsx', // needs jsdom + Amplify config
    ],
    reporters: ['default', ['junit', { outputFile: '../reports/junit-leaderboard.xml' }]],
  },
});
