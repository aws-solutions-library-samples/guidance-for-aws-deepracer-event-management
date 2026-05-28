import { CfnOutput, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnUserPoolUserToGroupAttachment } from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as customResources from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface E2eTestUsersProps extends NestedStackProps {
  userPoolId: string;
  email: string;
}

export class E2eTestUsers extends NestedStack {
  public readonly racerUsername: string;
  public readonly adminUsername: string;
  public readonly racerPasswordSecretArn: string;
  public readonly adminPasswordSecretArn: string;

  constructor(scope: Construct, id: string, props: E2eTestUsersProps) {
    super(scope, id, props);

    this.racerUsername = 'drem-test-racer';
    this.adminUsername = 'drem-test-admin';

    const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', props.userPoolId);

    const racerPasswordSecret = new secretsmanager.Secret(this, 'RacerPasswordSecret', {
      description: 'E2E test racer user password',
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: false,
        includeSpace: false,
        requireEachIncludedType: true,
      },
    });

    const adminPasswordSecret = new secretsmanager.Secret(this, 'AdminPasswordSecret', {
      description: 'E2E test admin user password',
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: false,
        includeSpace: false,
        requireEachIncludedType: true,
      },
    });

    const racerUser = new cognito.CfnUserPoolUser(this, 'TestRacerUser', {
      userPoolId: props.userPoolId,
      username: this.racerUsername,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [
        { name: 'email', value: props.email },
        { name: 'email_verified', value: 'true' },
      ],
      messageAction: 'SUPPRESS',
    });

    new CfnUserPoolUserToGroupAttachment(this, 'TestRacerToGroup', {
      userPoolId: props.userPoolId,
      groupName: 'racer',
      username: this.racerUsername,
    }).node.addDependency(racerUser);

    const adminUser = new cognito.CfnUserPoolUser(this, 'TestAdminUser', {
      userPoolId: props.userPoolId,
      username: this.adminUsername,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [
        { name: 'email', value: props.email },
        { name: 'email_verified', value: 'true' },
      ],
      messageAction: 'SUPPRESS',
    });

    new CfnUserPoolUserToGroupAttachment(this, 'TestAdminToGroup', {
      userPoolId: props.userPoolId,
      groupName: 'admin',
      username: this.adminUsername,
    }).node.addDependency(adminUser);

    const setPasswordRole = new iam.Role(this, 'SetPasswordRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        cognitoAdmin: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['cognito-idp:AdminSetUserPassword'],
              resources: [userPool.userPoolArn],
            }),
          ],
        }),
        secretsRead: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['secretsmanager:GetSecretValue'],
              resources: [racerPasswordSecret.secretArn, adminPasswordSecret.secretArn],
            }),
          ],
        }),
      },
    });

    const setRacerPassword = new customResources.AwsCustomResource(this, 'SetRacerPassword', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: props.userPoolId,
          Username: this.racerUsername,
          Password: racerPasswordSecret.secretValue.toString(),
          Permanent: true,
        },
        physicalResourceId: customResources.PhysicalResourceId.of('set-racer-password'),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: props.userPoolId,
          Username: this.racerUsername,
          Password: racerPasswordSecret.secretValue.toString(),
          Permanent: true,
        },
        physicalResourceId: customResources.PhysicalResourceId.of('set-racer-password'),
      },
      role: setPasswordRole,
    });
    setRacerPassword.node.addDependency(racerUser);

    const setAdminPassword = new customResources.AwsCustomResource(this, 'SetAdminPassword', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: props.userPoolId,
          Username: this.adminUsername,
          Password: adminPasswordSecret.secretValue.toString(),
          Permanent: true,
        },
        physicalResourceId: customResources.PhysicalResourceId.of('set-admin-password'),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: props.userPoolId,
          Username: this.adminUsername,
          Password: adminPasswordSecret.secretValue.toString(),
          Permanent: true,
        },
        physicalResourceId: customResources.PhysicalResourceId.of('set-admin-password'),
      },
      role: setPasswordRole,
    });
    setAdminPassword.node.addDependency(adminUser);

    this.racerPasswordSecretArn = racerPasswordSecret.secretArn;
    this.adminPasswordSecretArn = adminPasswordSecret.secretArn;

    new CfnOutput(this, 'TestRacerUsername', { value: this.racerUsername });
    new CfnOutput(this, 'TestAdminUsername', { value: this.adminUsername });
    new CfnOutput(this, 'TestRacerPasswordSecretArn', { value: racerPasswordSecret.secretArn });
    new CfnOutput(this, 'TestAdminPasswordSecretArn', { value: adminPasswordSecret.secretArn });

    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole on AwsCustomResource framework Lambda is managed by CDK.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'AwsCustomResource framework Lambda requires wildcard permissions; managed by CDK.',
        appliesTo: ['Resource::*'],
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'AwsCustomResource framework Lambda runtime is managed by CDK.',
      },
      {
        id: 'AwsSolutions-SMG4',
        reason: 'Test user password secrets do not need automatic rotation — they are synthetic test credentials.',
      },
    ], true);
  }
}
