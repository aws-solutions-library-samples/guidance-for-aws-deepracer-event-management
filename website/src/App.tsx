import {
  Authenticator,
  useAuthenticator,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { AwsRum } from 'aws-rum-web';
import { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';

import { CountrySelector } from './components/countrySelector';
import TopNav from './components/topNav';
import awsconfig from './config.json';
import { StoreProvider } from './store/contexts/storeProvider';
import initDataStores from './store/initStore';

import { translations } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import { useTranslation } from 'react-i18next';

/**
 * Form data structure for custom sign up validation
 */
interface SignUpFormData {
  username: string;
  'custom:countryCode'?: string;
  [key: string]: any;
}

/**
 * Validation errors object
 */
interface ValidationErrors {
  [key: string]: string;
}

/**
 * Legacy config shape produced by generate_amplify_config_cfn.py
 * We map this to Amplify v6 ResourcesConfig at runtime (Option A)
 * so the CDK scripts don't need to change.
 */
interface LegacyConfig {
  Auth: {
    region: string;
    userPoolId: string;
    userPoolWebClientId: string;
    identityPoolId: string;
  };
  Storage: {
    region: string;
    bucket: string;
    uploadBucket: string;
    identityPoolId: string;
  };
  API: {
    aws_appsync_graphqlEndpoint: string;
    aws_appsync_region: string;
    aws_appsync_authenticationType: string;
  };
  Urls?: {
    leaderboardWebsite?: string;
    streamingOverlayWebsite?: string;
  };
  Rum?: {
    drem: {
      config: string;
      id: string;
      region: string;
    };
  };
}

const config = awsconfig as LegacyConfig;

/** Map legacy config.json → Amplify v6 ResourcesConfig */
function buildAmplifyConfig(legacy: LegacyConfig): ResourcesConfig {
  return {
    Auth: {
      Cognito: {
        userPoolId: legacy.Auth.userPoolId,
        userPoolClientId: legacy.Auth.userPoolWebClientId,
        identityPoolId: legacy.Auth.identityPoolId,
      },
    },
    API: {
      GraphQL: {
        endpoint: legacy.API.aws_appsync_graphqlEndpoint,
        region: legacy.API.aws_appsync_region,
        defaultAuthMode: 'userPool',
      },
    },
    Storage: {
      S3: {
        bucket: legacy.Storage.bucket,
        region: legacy.Storage.region,
      },
    },
  };
}

I18n.putVocabularies(translations);

Amplify.configure(buildAmplifyConfig(config));

// Expose AppSync endpoint for legacy browser pages (e.g. car-activation-legacy.html)
(window as any).__DREM_APPSYNC_ENDPOINT__ = config.API.aws_appsync_graphqlEndpoint;
sessionStorage.setItem('drem_appsync_endpoint', config.API.aws_appsync_graphqlEndpoint);

initDataStores();

let awsRum: AwsRum | null = null;
try {
  const rumConfig = JSON.parse(config.Rum?.drem.config || '{}');
  const APPLICATION_ID = config.Rum?.drem.id || '';
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = config.Rum?.drem.region || '';

  /*eslint no-unused-vars: ["error", { "varsIgnorePattern": "awsRum" }]*/
  if (APPLICATION_ID && APPLICATION_REGION) {
    awsRum = new AwsRum(APPLICATION_ID, APPLICATION_VERSION, APPLICATION_REGION, rumConfig);
  }
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

          <CountrySelector
            amplify={true}
            description={Array.isArray(validationErrors.countryCode) ? validationErrors.countryCode[0] : validationErrors.countryCode}
          />
        </>
      );
    },
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
          async validateCustomSignUp(formData: SignUpFormData): Promise<ValidationErrors> {
            const errors: ValidationErrors = {};

            const validUsername = new RegExp(
              '^(?=.{2,20}$)(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$'
            );

            if (!validUsername.test(formData.username)) {
              errors['username'] = t('app.signup.username-error');
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
                <TopNav user={user?.username || ''} signout={signOut} />
              </Router>
            </StoreProvider>
          </main>
        )}
      </Authenticator>
    </Suspense>
  );
}
