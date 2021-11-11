import './App.css';
import React from 'react';
import awsconfig from './config.json';
import Amplify from 'aws-amplify';
import { AmplifyAuthenticator, AmplifySignOut, AmplifySignIn } from '@aws-amplify/ui-react';
import { AuthState, onAuthUIStateChange } from '@aws-amplify/ui-components';
import { Header } from 'semantic-ui-react';

import { Menu } from './menu.js';

Amplify.configure(awsconfig);


function App() {
  const [authState, setAuthState] = React.useState();
  const [user, setUser] = React.useState();

  React.useEffect(() => {
      onAuthUIStateChange((nextAuthState, authData) => {
          setAuthState(nextAuthState);
          setUser(authData)
      });
  }, []);

  return authState === AuthState.SignedIn && user ? (
      <div className="App">
          <Header as='h1'>Hello {user.username}</Header>
          <Menu />
          <AmplifySignOut />
      </div>
    ) : (
      <AmplifyAuthenticator>
        <AmplifySignIn // https://docs.amplify.aws/ui/auth/authenticator/q/framework/react#sign-in
          hideSignUp="true"
          slot="sign-in"
        ></AmplifySignIn>
      </AmplifyAuthenticator>
    );
}

export default App;
