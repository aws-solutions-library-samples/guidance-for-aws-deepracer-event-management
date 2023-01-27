'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CognitoUser = exports.Idp = void 0;
const cdk = require('aws-cdk-lib');
const aws_cdk_lib_1 = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const aws_cognito_1 = require('aws-cdk-lib/aws-cognito');
const iam = require('aws-cdk-lib/aws-iam');
const constructs_1 = require('constructs');
class Idp extends constructs_1.Construct {
  constructor(scope, id, props) {
    super(scope, id);
    const stack = cdk.Stack.of(this);
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: stack.stackName,
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      mfa: cognito.Mfa.OPTIONAL,
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        requireUppercase: true,
        tempPasswordValidity: aws_cdk_lib_1.Duration.days(2),
      },
      userInvitation: {
        emailSubject: 'Invite to join DREM',
        emailBody:
          'Hello {username}, you have been invited to join DREM. \n' +
          'Your temporary password is \n\n{####}\n\n' +
          'https://' +
          props.distribution.distributionDomainName,
        smsMessage: 'Hello {username}, your temporary password for DREM is {####}',
      },
      userVerification: {
        emailSubject: 'Verify your email for DREM',
        emailBody: 'Thanks for signing up to DREM \n\nYour verification code is \n{####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
        smsMessage: 'Thanks for signing up to DREM. Your verification code is {####}',
      },
    });
    this.userPool = userPool;
    //         NagSuppressions.add_resource_suppressions(
    //             self._userPool,
    //             suppressions=[
    //                 {
    //                     "id": "AwsSolutions-COG2",
    //                     "reason": (
    //                         "users only sign up and us DREM for a short period of time, all"
    //                         " users are deleted after 10 days inactivity"
    //                     ),
    //                 },
    //                 {
    //                     "id": "AwsSolutions-COG3",
    //                     "reason": (
    //                         "users only sign up and us DREM for a short period of time, all"
    //                         " users are deleted after 10 days inactivity"
    //                     ),
    //                 },
    //             ],
    //         )
    //  Cognito Client
    const userPoolClientWeb = new cognito.UserPoolClient(this, 'UserPoolClientWeb', {
      userPool: userPool,
      preventUserExistenceErrors: true,
    });
    userPool.addClient('DremClient', {
      oAuth: {
        callbackUrls: [
          'https://' + props.distribution.distributionDomainName,
          'http://localhost:3000',
        ],
        logoutUrls: [
          'https://' + props.distribution.distributionDomainName,
          'http://localhost:3000',
        ],
      },
    });
    //  Cognito Identity Pool
    const cognitoIdentityProviderProperty = {
      clientId: userPoolClientWeb.userPoolClientId,
      providerName: userPool.userPoolProviderName,
    };
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [cognitoIdentityProviderProperty],
    });
    // Cognito Identity Pool Authenitcated Role
    const authUserRole = new iam.Role(this, 'CognitoDefaultAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });
    //  Cognito Identity Pool Unauthenitcated Role
    //  needed for accessing stream overlays
    const unauthUserRole = new iam.Role(this, 'CognitoDefaultUnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authUserRole.roleArn,
      },
      roleMappings: {
        role_mapping: {
          type: 'Token',
          identityProvider:
            userPool.userPoolProviderName + ':' + userPoolClientWeb.userPoolClientId,
          ambiguousRoleResolution: 'AuthenticatedRole',
        },
      },
    });
    //  Admin Users Group Role
    const adminGroupRole = new iam.Role(this, 'AdminUserGroupRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });
    this.adminGroupRole = adminGroupRole;
    // Operator Users Group Role
    const operatorGroupRole = new iam.Role(this, 'OperatorUserRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });
    this.operatorGroupRole = operatorGroupRole;
    //  Cognito User Group (Operator)
    const operatorGroup = new cognito.CfnUserPoolGroup(this, 'OperatorGroup', {
      userPoolId: userPool.userPoolId,
      description: 'Operator user group',
      groupName: 'operator',
      precedence: 1,
      roleArn: operatorGroupRole.roleArn,
    });
    //  Cognito User Group (Admin)
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      description: 'Admin user group',
      groupName: 'admin',
      precedence: 1,
      roleArn: adminGroupRole.roleArn,
    });
    //  Add a default Admin user to the system
    const defaultAdminUserName = 'admin';
    new CognitoUser(this, 'DefaultAdminUser', {
      username: defaultAdminUserName,
      email: props.defaultAdminEmail,
      userPool: userPool,
      groupName: adminGroup.ref,
    });
    // Outputs
    new aws_cdk_lib_1.CfnOutput(this, 'userPoolWebClientId', {
      value: userPoolClientWeb.userPoolClientId,
    });
    new aws_cdk_lib_1.CfnOutput(this, 'identityPoolId', {
      value: identityPool.ref,
    });
    new aws_cdk_lib_1.CfnOutput(this, 'userPoolId', {
      value: userPool.userPoolId,
    });
    new aws_cdk_lib_1.CfnOutput(this, 'DefaultAdminUserUsername', { value: defaultAdminUserName });
    new aws_cdk_lib_1.CfnOutput(this, 'DefaultAdminEmail', { value: props.defaultAdminEmail });
  }
}
exports.Idp = Idp;
class CognitoUser extends constructs_1.Construct {
  // Creates a user in the provided Cognito User pool
  constructor(scope, id, props) {
    super(scope, id);
    const user = new cognito.CfnUserPoolUser(this, 'adminUser', {
      userPoolId: props.userPool.userPoolId,
      username: props.username,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [{ name: 'email', value: props.email }],
    });
    // If a Group Name is provided, also add the user to this Cognito UserPool Group
    if (props.groupName) {
      const userToGroupAttachment = new aws_cognito_1.CfnUserPoolUserToGroupAttachment(
        this,
        'AdminUserToAdminGroup',
        {
          userPoolId: user.userPoolId,
          groupName: props.groupName,
          username: user.username,
        }
      );
      userToGroupAttachment.node.addDependency(user);
      userToGroupAttachment.node.addDependency(props.userPool);
    }
  }
}
exports.CognitoUser = CognitoUser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaWRwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyw2Q0FBaUU7QUFFakUsbURBQW1EO0FBQ25ELHlEQUEyRTtBQUMzRSwyQ0FBMkM7QUFDM0MsMkNBQXVDO0FBT3ZDLE1BQWEsR0FBSSxTQUFRLHNCQUFTO0lBUTlCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZTtRQUNyRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBRWhDLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3BELFlBQVksRUFBRSxLQUFLLENBQUMsU0FBUztZQUM3QixrQkFBa0IsRUFBRTtnQkFDaEIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2FBQzNDO1lBQ0QsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0IsYUFBYSxFQUFFLDJCQUFhLENBQUMsT0FBTztZQUNwQyxjQUFjLEVBQUU7Z0JBQ1osU0FBUyxFQUFFLENBQUM7Z0JBQ1osZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixvQkFBb0IsRUFBRSxzQkFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDekM7WUFDRCxjQUFjLEVBQUU7Z0JBQ1osWUFBWSxFQUFFLHFCQUFxQjtnQkFDbkMsU0FBUyxFQUFFLENB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QUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1NBRTNEO0lBQ1AsQ0FBQztDQUNGO0FBM0JELGtDQTJCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDZm5PdXRwdXQsIER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCB7IENmblVzZXJQb29sVXNlclRvR3JvdXBBdHRhY2htZW50IH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSWRwUHJvcHMge1xuICAgIGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5JRGlzdHJpYnV0aW9uO1xuICAgIGRlZmF1bHRBZG1pbkVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBJZHAgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuXG4gICAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLklVc2VyUG9vbDtcbiAgICBwdWJsaWMgcmVhZG9ubHkgaWRlbnRpdHlQb29sOiBjb2duaXRvLkNmbklkZW50aXR5UG9vbDtcbiAgICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5Hcm91cFJvbGU6IGlhbS5JUm9sZVxuICAgIHB1YmxpYyByZWFkb25seSBvcGVyYXRvckdyb3VwUm9sZTogaWFtLklSb2xlO1xuICAgIHB1YmxpYyByZWFkb25seSB1bmF1dGhlbnRpY2F0ZWRfdXNlcl9yb2xlOiBpYW0uSVJvbGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSWRwUHJvcHMpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICBjb25zdCBzdGFjayA9IGNkay5TdGFjay5vZih0aGlzKVxuXG4gICAgICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgICAgICAgdXNlclBvb2xOYW1lOiBzdGFjay5zdGFja05hbWUsXG4gICAgICAgICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWZhOiBjb2duaXRvLk1mYS5PUFRJT05BTCxcbiAgICAgICAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgICAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgICAgICAgICAgdGVtcFBhc3N3b3JkVmFsaWRpdHk6IER1cmF0aW9uLmRheXMoMilcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1c2VySW52aXRhdGlvbjoge1xuICAgICAgICAgICAgICAgIGVtYWlsU3ViamVjdDogXCJJbnZpdGUgdG8gam9pbiBEUkVNXCIsXG4gICAgICAgICAgICAgICAgZW1haWxCb2R5OiAoXCJIZWxsbyB7dXNlcm5hbWV9LCB5b3UgaGF2ZSBiZWVuIGludml0ZWQgdG8gam9pbiBEUkVNLiBcXG5cIiArXG4gICAgICAgICAgICAgICAgICAgIFwiWW91ciB0ZW1wb3JhcnkgcGFzc3dvcmQgaXMgXFxuXFxueyMjIyN9XFxuXFxuXCIpXG4gICAgICAgICAgICAgICAgICAgICsgXCJodHRwczovL1wiICsgcHJvcHMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgICAgICAgICAgc21zTWVzc2FnZTogKFwiSGVsbG8ge3VzZXJuYW1lfSwgeW91ciB0ZW1wb3JhcnkgcGFzc3dvcmQgZm9yIERSRU0gaXMgeyMjIyN9XCIpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVzZXJWZXJpZmljYXRpb246IHtcbiAgICAgICAgICAgICAgICBlbWFpbFN1YmplY3Q6IFwiVmVyaWZ5IHlvdXIgZW1haWwgZm9yIERSRU1cIixcbiAgICAgICAgICAgICAgICBlbWFpbEJvZHk6IFwiVGhhbmtzIGZvciBzaWduaW5nIHVwIHRvIERSRU0gXFxuXFxuWW91ciB2ZXJpZmljYXRpb24gY29kZSBpcyBcXG57IyMjI31cIixcbiAgICAgICAgICAgICAgICBlbWFpbFN0eWxlOiBjb2duaXRvLlZlcmlmaWNhdGlvbkVtYWlsU3R5bGUuQ09ERSxcbiAgICAgICAgICAgICAgICBzbXNNZXNzYWdlOiBcIlRoYW5rcyBmb3Igc2lnbmluZyB1cCB0byBEUkVNLiBZb3VyIHZlcmlmaWNhdGlvbiBjb2RlIGlzIHsjIyMjfVwiLFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMudXNlclBvb2wgPSB1c2VyUG9vbFxuXG4gICAgICAgIC8vICAgICAgICAgTmFnU3VwcHJlc3Npb25zLmFkZF9yZXNvdXJjZV9zdXBwcmVzc2lvbnMoXG4gICAgICAgIC8vICAgICAgICAgICAgIHNlbGYuX3VzZXJQb29sLFxuICAgICAgICAvLyAgICAgICAgICAgICBzdXBwcmVzc2lvbnM9W1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJBd3NTb2x1dGlvbnMtQ09HMlwiLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIFwicmVhc29uXCI6IChcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgXCJ1c2VycyBvbmx5IHNpZ24gdXAgYW5kIHVzIERSRU0gZm9yIGEgc2hvcnQgcGVyaW9kIG9mIHRpbWUsIGFsbFwiXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIFwiIHVzZXJzIGFyZSBkZWxldGVkIGFmdGVyIDEwIGRheXMgaW5hY3Rpdml0eVwiXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiBcIkF3c1NvbHV0aW9ucy1DT0czXCIsXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgXCJyZWFzb25cIjogKFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICBcInVzZXJzIG9ubHkgc2lnbiB1cCBhbmQgdXMgRFJFTSBmb3IgYSBzaG9ydCBwZXJpb2Qgb2YgdGltZSwgYWxsXCJcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgXCIgdXNlcnMgYXJlIGRlbGV0ZWQgYWZ0ZXIgMTAgZGF5cyBpbmFjdGl2aXR5XCJcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICAgICAgXSxcbiAgICAgICAgLy8gICAgICAgICApXG5cblxuXG4gICAgICAgIC8vICBDb2duaXRvIENsaWVudFxuICAgICAgICBjb25zdCB1c2VyUG9vbENsaWVudFdlYiA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudFdlYicsIHtcbiAgICAgICAgICAgIHVzZXJQb29sOiB1c2VyUG9vbCxcbiAgICAgICAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlXG4gICAgICAgIH0pXG5cbiAgICAgICAgdXNlclBvb2wuYWRkQ2xpZW50KCdEcmVtQ2xpZW50Jywge1xuICAgICAgICAgICAgb0F1dGg6IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja1VybHM6IFtcbiAgICAgICAgICAgICAgICAgICAgXCJodHRwczovL1wiICsgcHJvcHMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgICAgICAgICAgIFwiaHR0cHM6Ly9cIiArIHByb3BzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgICAgICAgICAgICAgICBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvLyAgQ29nbml0byBJZGVudGl0eSBQb29sXG4gICAgICAgIGNvbnN0IGNvZ25pdG9JZGVudGl0eVByb3ZpZGVyUHJvcGVydHk6IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sLkNvZ25pdG9JZGVudGl0eVByb3ZpZGVyUHJvcGVydHkgPSB7XG4gICAgICAgICAgICBjbGllbnRJZDogdXNlclBvb2xDbGllbnRXZWIudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgICAgIHByb3ZpZGVyTmFtZTogdXNlclBvb2wudXNlclBvb2xQcm92aWRlck5hbWVcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlkZW50aXR5UG9vbCA9IG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCAnSWRlbnRpdHlQb29sJywge1xuICAgICAgICAgICAgYWxsb3dVbmF1dGhlbnRpY2F0ZWRJZGVudGl0aWVzOiBmYWxzZSxcbiAgICAgICAgICAgIGNvZ25pdG9JZGVudGl0eVByb3ZpZGVyczogW2NvZ25pdG9JZGVudGl0eVByb3ZpZGVyUHJvcGVydHldXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gQ29nbml0byBJZGVudGl0eSBQb29sIEF1dGhlbml0Y2F0ZWQgUm9sZVxuICAgICAgICBjb25zdCBhdXRoVXNlclJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0NvZ25pdG9EZWZhdWx0QXV0aGVudGljYXRlZFJvbGUnLCB7XG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20nLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJ1N0cmluZ0VxdWFscyc6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IGlkZW50aXR5UG9vbC5yZWYgfSxcbiAgICAgICAgICAgICAgICAgICAgJ0ZvckFueVZhbHVlOlN0cmluZ0xpa2UnOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcImF1dGhlbnRpY2F0ZWRcIiB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCJcbiAgICAgICAgICAgIClcbiAgICAgICAgfSlcblxuXG4gICAgICAgIC8vICBDb2duaXRvIElkZW50aXR5IFBvb2wgVW5hdXRoZW5pdGNhdGVkIFJvbGVcbiAgICAgICAgLy8gIG5lZWRlZCBmb3IgYWNjZXNzaW5nIHN0cmVhbSBvdmVybGF5c1xuICAgICAgICBjb25zdCB1bmF1dGhVc2VyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQ29nbml0b0RlZmF1bHRVbmF1dGhlbnRpY2F0ZWRSb2xlJywge1xuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiBpZGVudGl0eVBvb2wucmVmIH0sXG4gICAgICAgICAgICAgICAgICAgICdGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlJzogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXG4gICAgICAgICAgICApXG4gICAgICAgIH0pXG5cbiAgICAgICAgbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQodGhpcywgXCJJZGVudGl0eVBvb2xSb2xlQXR0YWNobWVudFwiLCB7XG4gICAgICAgICAgICBpZGVudGl0eVBvb2xJZDogaWRlbnRpdHlQb29sLnJlZixcbiAgICAgICAgICAgIHJvbGVzOiB7XG4gICAgICAgICAgICAgICdhdXRoZW50aWNhdGVkJzogYXV0aFVzZXJSb2xlLnJvbGVBcm5cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb2xlTWFwcGluZ3M6IHtcbiAgICAgICAgICAgICAgXCJyb2xlX21hcHBpbmdcIjoge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiVG9rZW5cIixcbiAgICAgICAgICAgICAgICBpZGVudGl0eVByb3ZpZGVyOiB1c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZSArIFwiOlwiICsgdXNlclBvb2xDbGllbnRXZWIudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgICAgICAgICBhbWJpZ3VvdXNSb2xlUmVzb2x1dGlvbjogJ0F1dGhlbnRpY2F0ZWRSb2xlJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcblxuICAgICAgICAvLyAgQWRtaW4gVXNlcnMgR3JvdXAgUm9sZVxuICAgICAgICBjb25zdCBhZG1pbkdyb3VwUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWRtaW5Vc2VyR3JvdXBSb2xlJywge1xuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcbiAgICAgICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbVwiLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJ1N0cmluZ0VxdWFscyc6IHsgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkXCI6IGlkZW50aXR5UG9vbC5yZWYgfSxcbiAgICAgICAgICAgICAgICAgICAgJ0ZvckFueVZhbHVlOlN0cmluZ0xpa2UnOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcImF1dGhlbnRpY2F0ZWRcIiB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBcInN0czpBc3N1bWVSb2xlV2l0aFdlYklkZW50aXR5XCJcbiAgICAgICAgICAgIClcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5hZG1pbkdyb3VwUm9sZSA9IGFkbWluR3JvdXBSb2xlXG5cbiAgICAgICAgLy8gT3BlcmF0b3IgVXNlcnMgR3JvdXAgUm9sZVxuICAgICAgICBjb25zdCBvcGVyYXRvckdyb3VwUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnT3BlcmF0b3JVc2VyUm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5GZWRlcmF0ZWRQcmluY2lwYWwoXG4gICAgICAgICAgICAgICAgXCJjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb21cIixcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdTdHJpbmdFcXVhbHMnOiB7IFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiBpZGVudGl0eVBvb2wucmVmIH0sXG4gICAgICAgICAgICAgICAgICAgICdGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlJzogeyBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXG4gICAgICAgICAgICApXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMub3BlcmF0b3JHcm91cFJvbGUgPSBvcGVyYXRvckdyb3VwUm9sZVxuXG4gICAgICAgIC8vICBDb2duaXRvIFVzZXIgR3JvdXAgKE9wZXJhdG9yKVxuICAgICAgICBjb25zdCBvcGVyYXRvckdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnT3BlcmF0b3JHcm91cCcsIHtcbiAgICAgICAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJPcGVyYXRvciB1c2VyIGdyb3VwXCIsXG4gICAgICAgICAgICBncm91cE5hbWU6ICdvcGVyYXRvcicsXG4gICAgICAgICAgICBwcmVjZWRlbmNlOiAxLFxuICAgICAgICAgICAgcm9sZUFybjogb3BlcmF0b3JHcm91cFJvbGUucm9sZUFyblxuICAgICAgICB9KTtcblxuICAgICAgICAvLyAgQ29nbml0byBVc2VyIEdyb3VwIChBZG1pbilcbiAgICAgICAgY29uc3QgYWRtaW5Hcm91cCA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgJ0FkbWluR3JvdXAnLCB7XG4gICAgICAgICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQWRtaW4gdXNlciBncm91cFwiLFxuICAgICAgICAgICAgZ3JvdXBOYW1lOiAnYWRtaW4nLFxuICAgICAgICAgICAgcHJlY2VkZW5jZTogMSxcbiAgICAgICAgICAgIHJvbGVBcm46IGFkbWluR3JvdXBSb2xlLnJvbGVBcm5cbiAgICAgICAgfSk7XG5cblxuICAgICAgICAvLyAgQWRkIGEgZGVmYXVsdCBBZG1pbiB1c2VyIHRvIHRoZSBzeXN0ZW1cbiAgICAgICAgY29uc3QgZGVmYXVsdEFkbWluVXNlck5hbWUgPSBcImFkbWluXCJcblxuICAgICAgICBuZXcgQ29nbml0b1VzZXIodGhpcywgXCJEZWZhdWx0QWRtaW5Vc2VyXCIsIHtcbiAgICAgICAgICAgIHVzZXJuYW1lOiBkZWZhdWx0QWRtaW5Vc2VyTmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiBwcm9wcy5kZWZhdWx0QWRtaW5FbWFpbCxcbiAgICAgICAgICAgIHVzZXJQb29sOiB1c2VyUG9vbCxcbiAgICAgICAgICAgIGdyb3VwTmFtZTogYWRtaW5Hcm91cC5yZWZcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gT3V0cHV0c1xuICAgICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwidXNlclBvb2xXZWJDbGllbnRJZFwiLCB7XG4gICAgICAgICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnRXZWIudXNlclBvb2xDbGllbnRJZFxuICAgICAgICB9KVxuXG4gICAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ2lkZW50aXR5UG9vbElkJywge1xuICAgICAgICAgICAgdmFsdWU6IGlkZW50aXR5UG9vbC5yZWZcbiAgICAgICAgfSlcblxuICAgICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICd1c2VyUG9vbElkJywge1xuICAgICAgICAgICAgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWRcbiAgICAgICAgfSlcblxuICAgICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiRGVmYXVsdEFkbWluVXNlclVzZXJuYW1lXCIsIHt2YWx1ZTogZGVmYXVsdEFkbWluVXNlck5hbWV9KVxuXG4gICAgICAgIG5ldyBDZm5PdXRwdXQodGhpcyxcIkRlZmF1bHRBZG1pbkVtYWlsXCIgLCB7dmFsdWU6IHByb3BzLmRlZmF1bHRBZG1pbkVtYWlsfSlcblxuICAgIH1cbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIENvZ25pdG9Vc2VyUHJvcHMge1xuICAgICAgICB1c2VybmFtZTogc3RyaW5nLFxuICAgICAgICBlbWFpbDogc3RyaW5nLFxuICAgICAgICB1c2VyUG9vbDogY29nbml0by5JVXNlclBvb2wsXG4gICAgICAgIGdyb3VwTmFtZT86IHN0cmluZyxcbn1cblxuZXhwb3J0IGNsYXNzIENvZ25pdG9Vc2VyIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgICAvLyBDcmVhdGVzIGEgdXNlciBpbiB0aGUgcHJvdmlkZWQgQ29nbml0byBVc2VyIHBvb2xcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb2duaXRvVXNlclByb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgY29uc3QgdXNlciA9IG5ldyBjb2duaXRvLkNmblVzZXJQb29sVXNlcih0aGlzLCAnYWRtaW5Vc2VyJywge1xuICAgICAgICAgICAgdXNlclBvb2xJZDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBwcm9wcy51c2VybmFtZSxcbiAgICAgICAgICAgIGRlc2lyZWREZWxpdmVyeU1lZGl1bXM6IFtcIkVNQUlMXCJdLFxuICAgICAgICAgICAgdXNlckF0dHJpYnV0ZXM6IFt7bmFtZTogXCJlbWFpbFwiLCB2YWx1ZTogcHJvcHMuZW1haWx9XVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIElmIGEgR3JvdXAgTmFtZSBpcyBwcm92aWRlZCwgYWxzbyBhZGQgdGhlIHVzZXIgdG8gdGhpcyBDb2duaXRvIFVzZXJQb29sIEdyb3VwXG4gICAgICAgIGlmIChwcm9wcy5ncm91cE5hbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXJUb0dyb3VwQXR0YWNobWVudCA9IG5ldyBDZm5Vc2VyUG9vbFVzZXJUb0dyb3VwQXR0YWNobWVudCh0aGlzLCAnQWRtaW5Vc2VyVG9BZG1pbkdyb3VwJywge1xuICAgICAgICAgICAgICAgIHVzZXJQb29sSWQ6IHVzZXIudXNlclBvb2xJZCxcbiAgICAgICAgICAgICAgICBncm91cE5hbWU6IHByb3BzLmdyb3VwTmFtZSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSFcblxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgdXNlclRvR3JvdXBBdHRhY2htZW50Lm5vZGUuYWRkRGVwZW5kZW5jeSh1c2VyKVxuICAgICAgICAgICAgdXNlclRvR3JvdXBBdHRhY2htZW50Lm5vZGUuYWRkRGVwZW5kZW5jeShwcm9wcy51c2VyUG9vbClcblxuICAgICAgICB9XG4gIH1cbn1cbiJdfQ==
