import './App.css';
import React from 'react';
import awsconfig from './config.json';
import Amplify from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './amplify.css';

import { Menu } from './menu.js';
import { Header, Button } from 'semantic-ui-react'

Amplify.configure(awsconfig);


export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          <Header as='h1' icon textAlign='center'>Hello {user.username}</Header>
          <Menu />
          <Button fluid onClick={signOut}>Sign out</Button>
        </main>
      )}
    </Authenticator>
  );
}
