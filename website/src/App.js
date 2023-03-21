import {
  Authenticator,
  CheckboxField,
  Link,
  useAuthenticator,
  useTheme,
  View
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Amplify from 'aws-amplify';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';

import { CountrySelector } from './components/countrySelector';
import TopNav from './components/topNav';
import awsconfig from './config.json';
import { AppLayoutProvider } from './store/appLayoutProvider';
import CarsProvider from './store/carProvider';
import EventProvider from './store/eventProvider';
import { FleetProvider } from './store/fleetProvider';
import { UsersProvider } from './store/usersProvider';

Amplify.configure(awsconfig);

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
            errors['username'] = 'Please enter a valid username. You are allowed A-Z, a-z and 0-9 (2 - 20 characters)';
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
          <AppLayoutProvider>
            <CarsProvider>
              <FleetProvider>
                <EventProvider>
                  <UsersProvider>
                    <Router>
                      <TopNav user={user.username} signout={signOut} />
                    </Router>
                  </UsersProvider>
                </EventProvider>
              </FleetProvider>
            </CarsProvider>
          </AppLayoutProvider>
        </main>
      )}
    </Authenticator>
  );
}
