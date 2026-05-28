import { CfnOutput, CustomResource, Duration, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnUserPoolUserToGroupAttachment } from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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

    const stack = Stack.of(this);

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

    // Custom resource Lambda that reads passwords from Secrets Manager and
    // sets them on the Cognito test users. Defence-in-depth: the Lambda
    // hardcodes the allowed usernames and rejects any other.
    const setPasswordFn = new lambda.Function(this, 'SetTestPasswordsFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      code: lambda.Code.fromInline(`
import json
import boto3
import cfnresponse

ALLOWED_USERNAMES = frozenset(['drem-test-racer', 'drem-test-admin'])

cognito_client = boto3.client('cognito-idp')
secrets_client = boto3.client('secretsmanager')

def handler(event, context):
    try:
        if event['RequestType'] == 'Delete':
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            return

        props = event['ResourceProperties']
        user_pool_id = props['UserPoolId']
        users = json.loads(props['Users'])

        for user in users:
            username = user['username']
            secret_arn = user['secretArn']

            if username not in ALLOWED_USERNAMES:
                raise ValueError(f'Username {username} not in allowed list')

            secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
            password = secret_response['SecretString']

            cognito_client.admin_set_user_password(
                UserPoolId=user_pool_id,
                Username=username,
                Password=password,
                Permanent=True,
            )

        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
    except Exception as e:
        print(f'Error: {e}')
        cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
`),
    });

    setPasswordFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminSetUserPassword'],
      resources: [userPool.userPoolArn],
    }));

    setPasswordFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [racerPasswordSecret.secretArn, adminPasswordSecret.secretArn],
    }));

    const provider = new customResources.Provider(this, 'SetPasswordProvider', {
      onEventHandler: setPasswordFn,
    });

    const setPasswordsCr = new CustomResource(this, 'SetTestPasswords', {
      serviceToken: provider.serviceToken,
      properties: {
        UserPoolId: props.userPoolId,
        Users: JSON.stringify([
          { username: this.racerUsername, secretArn: racerPasswordSecret.secretArn },
          { username: this.adminUsername, secretArn: adminPasswordSecret.secretArn },
        ]),
      },
    });
    setPasswordsCr.node.addDependency(racerUser);
    setPasswordsCr.node.addDependency(adminUser);

    this.racerPasswordSecretArn = racerPasswordSecret.secretArn;
    this.adminPasswordSecretArn = adminPasswordSecret.secretArn;

    new CfnOutput(this, 'TestRacerUsername', { value: this.racerUsername });
    new CfnOutput(this, 'TestAdminUsername', { value: this.adminUsername });
    new CfnOutput(this, 'TestRacerPasswordSecretArn', { value: racerPasswordSecret.secretArn });
    new CfnOutput(this, 'TestAdminPasswordSecretArn', { value: adminPasswordSecret.secretArn });

    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole on the Provider framework Lambda is managed by CDK.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Provider framework Lambda requires wildcard permissions; managed by CDK custom-resources module.',
        appliesTo: ['Resource::*'],
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'Provider framework Lambda runtime is managed by CDK.',
      },
      {
        id: 'AwsSolutions-SMG4',
        reason: 'Test user password secrets do not need automatic rotation — they are synthetic test credentials.',
      },
    ], true);
  }
}
