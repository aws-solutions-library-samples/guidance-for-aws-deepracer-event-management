import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import awsconfig from './config.json';

import '@cloudscape-design/global-styles/index.css';
import { AwsRum } from 'aws-rum-web';
import { LeaderboardWrapper } from './components/leaderboardWrapper';
import { LandingPage } from './pages/landingPage';

/**
 * Legacy config shape produced by generate_leaderboard_amplify_config_cfn.py
 * We map this to Amplify v6 ResourcesConfig at runtime so the CDK scripts
 * don't need to change.
 */
interface LegacyLeaderboardConfig {
  API: {
    aws_appsync_graphqlEndpoint: string;
    aws_appsync_region: string;
    aws_appsync_authenticationType: string;
    aws_appsync_apiKey: string;
  };
  Urls?: {
    drem: string;
  };
  Rum?: {
    leaderboard: {
      id: string;
      region: string;
      config: string;
    };
  };
}

const config = awsconfig as LegacyLeaderboardConfig;

/** Map legacy config.json → Amplify v6 ResourcesConfig */
function buildAmplifyConfig(legacy: LegacyLeaderboardConfig): ResourcesConfig {
  return {
    API: {
      GraphQL: {
        endpoint: legacy.API.aws_appsync_graphqlEndpoint,
        region: legacy.API.aws_appsync_region,
        defaultAuthMode: 'apiKey',
        apiKey: legacy.API.aws_appsync_apiKey,
      },
    },
  };
}

Amplify.configure(buildAmplifyConfig(config));

let awsRum: AwsRum | null = null;
try {
  const rumConfig = JSON.parse(config.Rum?.leaderboard.config || '{}');
  const APPLICATION_ID = config.Rum?.leaderboard.id || '';
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = config.Rum?.leaderboard.region || '';

  if (APPLICATION_ID && APPLICATION_REGION) {
    awsRum = new AwsRum(APPLICATION_ID, APPLICATION_VERSION, APPLICATION_REGION, rumConfig);
  }
} catch (error) {
  // Ignore errors thrown during CloudWatch RUM web client initialization
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <LeaderboardWrapper />,
  },
  {
    path: '/:eventId',
    element: <LeaderboardWrapper />,
  },
  {
    path: '/leaderboard/:eventId',
    element: <LeaderboardWrapper />,
  },
  {
    path: '/landing-page/:eventId',
    element: <LandingPage />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
