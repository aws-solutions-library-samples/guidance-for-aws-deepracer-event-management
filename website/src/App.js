import {
  Authenticator,
  CheckboxField,
  Link,
  useAuthenticator,
  useTheme,
  View,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import { AwsRum } from 'aws-rum-web';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';

import { CountrySelector } from './components/countrySelector';
import TopNav from './components/topNav';
import awsconfig from './config.json';
import { AppLayoutProvider } from './store/appLayoutProvider';
import { PermissionProvider } from './store/permissions/permissionsProvider';
import { StoreProvider } from './store/storeProvider';

Amplify.configure(awsconfig);

let awsRum = null;
try {
  const config = JSON.parse(awsconfig.Rum.drem.config);
  const APPLICATION_ID = awsconfig.Rum.drem.id;
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = 'eu-west-1';

  /*eslint no-unused-vars: ["error", { "varsIgnorePattern": "awsRum" }]*/
  awsRum = new AwsRum(APPLICATION_ID, APPLICATION_VERSION, APPLICATION_REGION, config);
} catch (error) {
  // Ignore errors thrown during CloudWatch RUM web client initialization
}

const components = {
  Header() {
    // const { tokens } = useTheme();

    return <img src="/logo-bw.png" alt="Logo" width={300} height={300} className="center" />;
  },
  SignUp: {
    FormFields() {
      const { validationErrors } = useAuthenticator();

      return (
        <>
          {/* Re-use default `Authenticator.SignUp.FormFields` */}
          <Authenticator.SignUp.FormFields />

          <CountrySelector amplify={true} description={validationErrors.countryCode} />

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
    },
  },

  Footer() {
    const { tokens } = useTheme();

    return (
      <View textAlign="center" padding={tokens.space.large}>
        <Link
          href={awsconfig.Urls.termsAndConditionsUrl + '/terms-and-conditions.html'}
          target="_blank"
        >
          Terms and Conditions
        </Link>
      </View>
    );
  },
};

export default function App() {
  return (
    <Authenticator
      components={components}
      services={{
        async validateCustomSignUp(formData) {
          const errors = {};
          //regex user a-z0-9
          const validUsername = new RegExp(
            '^(?=.{2,20}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$'
          );

          if (!validUsername.test(formData.username)) {
            errors['username'] =
              'Please enter a valid username. You are allowed A-Z, a-z and 0-9 (2 - 20 characters)';
          }
          if (!formData.acknowledgement) {
            errors['acknowledgement'] = 'You must agree to the Terms & Conditions';
          }
          if (!formData['custom:countryCode']) {
            errors['countryCode'] = 'You must pick a country';
          }
          return errors;
        },
      }}
      hideSignUp={false}
      signUpAttributes={['email']}
    >
      {({ signOut, user }) => (
        <main>
          <PermissionProvider>
            <AppLayoutProvider>
              <StoreProvider>
                <Router>
                  <TopNav user={user.username} signout={signOut} />
                </Router>
              </StoreProvider>
            </AppLayoutProvider>
          </PermissionProvider>
        </main>
      )}
    </Authenticator>
  );
}
