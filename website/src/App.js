import './App.css';
import React from 'react';
import awsconfig from './config.json';
import Amplify from 'aws-amplify';
import { Authenticator, View, useTheme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './amplify.css';

import FixedMenuLayout from './FixedMenuLayout.js';
import { Image } from 'semantic-ui-react'

Amplify.configure(awsconfig);

const components = {
  Header() {
    const { tokens } = useTheme();

    return (
      <View textAlign="center" padding={tokens.space.large}>
        <Image alt="DeepRacer Logo" src="/logo-bw.png" size='large' centered />
      </View>
    );
  },
}

export default function App() {
  return (
    <Authenticator components={components}>
      {({ signOut, user }) => (
        <main>
          <FixedMenuLayout user={user.username} signout={signOut}/>
        </main>
      )}
    </Authenticator>
  );
}
