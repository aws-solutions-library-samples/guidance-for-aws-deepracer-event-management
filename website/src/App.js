import './App.css';
import React from 'react';
import awsconfig from './config.json';
import Amplify from 'aws-amplify';
import { Authenticator, View, useTheme, useAuthenticator, CheckboxField, Link } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

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

  SignUp: {
    FormFields() {
      const { validationErrors } = useAuthenticator();

      return (
        <>
          {/* Re-use default `Authenticator.SignUp.FormFields` */}
          <Authenticator.SignUp.FormFields />

          {/* Append & require Terms & Conditions field to sign up  */}
          <CheckboxField
            errorMessage={validationErrors.acknowledgement}
            hasError={!!validationErrors.acknowledgement}
            name="acknowledgement"
            value="yes"
            label="I agree with the Terms & Conditions"
          />
        </>
      );
    }
  },

  Footer() {
    const { tokens } = useTheme();

    return (
      <View textAlign="center" padding={tokens.space.large}>
        <Link href="/terms_and_conditions.html" target="_blank">
          Terms and Conditions
        </Link>
      </View>
    );
  },
}

export default function App() {
  return (
    <Authenticator
      components={components}
      services={{
        async validateCustomSignUp(formData) {
          if (!formData.acknowledgement) {
            return {
              acknowledgement: 'You must agree to the Terms & Conditions',
            };
          }
        },
      }}
      hideSignUp={false}
      signUpAttributes={['email']}
    >
      {({ signOut, user }) => (
        <main>
          <FixedMenuLayout user={user.username} signout={signOut}/>
        </main>
      )}
    </Authenticator>
  );
}
