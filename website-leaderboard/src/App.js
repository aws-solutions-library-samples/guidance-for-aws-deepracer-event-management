import { Amplify } from 'aws-amplify';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import awsconfig from './config.json';

import '@cloudscape-design/global-styles/index.css';
import { LandingPage } from './pages/landingPage';
import { LeaderboardWrapper } from './components/leaderboardWrapper';

Amplify.configure(awsconfig);

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
