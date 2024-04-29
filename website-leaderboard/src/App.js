import { Amplify } from 'aws-amplify';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import awsconfig from './config.json';

import '@cloudscape-design/global-styles/index.css';
import { AwsRum } from 'aws-rum-web';
import { LeaderboardWrapper } from './components/leaderboardWrapper';
import { LandingPage } from './pages/landingPage';

Amplify.configure(awsconfig);

let awsRum = null;
try {
  const config = JSON.parse(awsconfig.Rum.leaderboard.config);
  const APPLICATION_ID = awsconfig.Rum.leaderboard.id;
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = awsconfig.API.aws_appsync_region;

  /*eslint no-unused-vars: ["error", { "varsIgnorePattern": "awsRum" }]*/
  awsRum = new AwsRum(APPLICATION_ID, APPLICATION_VERSION, APPLICATION_REGION, config);
} catch (error) {
  // Ignore errors thrown during CloudWatch RUM web client initialization
}

function App() {
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

  return <RouterProvider router={router} />;
}

export default App;
