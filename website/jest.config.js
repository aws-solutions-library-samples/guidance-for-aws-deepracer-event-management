module.exports = {
  preset: 'react-scripts',
  transformIgnorePatterns: [
    'node_modules/(?!(@cloudscape-design|@aws-amplify|@xstate)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testEnvironment: 'jsdom',
};
