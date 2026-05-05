import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { RacerProfile } from '../lib/constructs/racer-profile';

const ENV = { account: '123456789012', region: 'eu-west-1' };

const makeStack = () => {
  const app = new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const stack = new cdk.Stack(app, 'TestStack', { env: ENV });
  const schema = new CodeFirstSchema();
  const userPool = new cognito.UserPool(stack, 'TestUserPool');
  const api = new appsync.GraphqlApi(stack, 'TestApi', {
    name: 'TestApi',
    schema,
    authorizationConfig: {
      defaultAuthorization: { authorizationType: appsync.AuthorizationType.API_KEY },
      additionalAuthorizationModes: [
        { authorizationType: appsync.AuthorizationType.IAM },
        {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      ],
    },
  });
  new RacerProfile(stack, 'RacerProfile', {
    appsyncApi: { api, schema },
  });
  return Template.fromStack(stack);
};

describe('RacerProfile construct', () => {
  let template: Template;
  beforeAll(() => { template = makeStack(); });

  test('creates a DynamoDB table keyed by username', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'username', KeyType: 'HASH' }],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: 'username', AttributeType: 'S' },
      ]),
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  test('attaches three resolvers (updateRacerProfile, updateRacerProfileForUser, getRacerProfile)', () => {
    template.resourceCountIs('AWS::AppSync::Resolver', 3);
  });
});
