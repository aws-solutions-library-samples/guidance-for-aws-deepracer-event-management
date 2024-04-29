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
import React, { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';

import { CountrySelector } from './components/countrySelector';
import TopNav from './components/topNav';
import awsconfig from './config.json';
import i18next from './i18n';
import { StoreProvider } from './store/contexts/storeProvider';
import initDataStores from './store/initStore';

import { translations } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify';
import { useTranslation } from 'react-i18next';
I18n.putVocabularies(translations);

Amplify.configure(awsconfig);

initDataStores();

let awsRum = null;
try {
  const config = JSON.parse(awsconfig.Rum.drem.config);
  const APPLICATION_ID = awsconfig.Rum.drem.id;
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = awsconfig.Auth.region;

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
            label={i18next.t('app.signup.acknowledgement-label')}
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
          {i18next.t('app.signup.terms-and-conditions')}
        </Link>
      </View>
    );
  },
};

export default function App() {
  const { t } = useTranslation();
  // https://github.com/aws-amplify/amplify-ui/blob/main/packages/ui/src/i18n/dictionaries/authenticator/en.ts
  I18n.putVocabularies({
    en: {
      'Sign In': t('app.signup.signin'),
      'Create Account': t('app.signup.create-account'),
      Username: t('app.signup.username'),
      'Enter your Username': t('app.signup.enter-your-username'),
      Password: t('app.signup.password'),
      'Enter your Password': t('app.signup.enter-your-password'),
      'Forgot password?': t('app.signup.forgot-your-password'),
      'Please confirm your Password': t('app.signup.confirm-password'),
      'Enter your Email': t('app.signup.enter-your-email'),
    },
  });

  return (
    <Suspense fallback="loading">
      <Authenticator
        components={components}
        services={{
          async validateCustomSignUp(formData) {
            const errors = {};

            const validUsername = new RegExp(
              '^(?=.{2,20}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$'
            );

            if (!validUsername.test(formData.username)) {
              errors['username'] = t('app.signup.username-error');
            }
            if (!formData.acknowledgement) {
              errors['acknowledgement'] = t('app.signup.acknowledgement');
            }
            if (!formData['custom:countryCode']) {
              errors['countryCode'] = t('app.signup.select-your-country');
            }
            return errors;
          },
        }}
        hideSignUp={false}
        signUpAttributes={['email']}
      >
        {({ signOut, user }) => (
          <main>
            <StoreProvider>
              <Router>
                <TopNav user={user.username} signout={signOut} />
              </Router>
            </StoreProvider>
          </main>
        )}
      </Authenticator>
    </Suspense>
  );
}
