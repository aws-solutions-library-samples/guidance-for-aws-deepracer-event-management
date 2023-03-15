import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnUserPoolUserToGroupAttachment } from 'aws-cdk-lib/aws-cognito';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface IdpProps {
    distribution: cloudfront.IDistribution;
    defaultAdminEmail: string;
    lambdaConfig: {
        runtime: lambda.Runtime;
        architecture: lambda.Architecture;
        bundlingImage: DockerImage;
        layersConfig: {
            powerToolsLogLevel: string;
            helperFunctionsLayer: lambda.ILayerVersion;
            powerToolsLayer: lambda.ILayerVersion;
        };
    };
    eventbus: EventBus;
}

export class Idp extends Construct {
    public readonly userPool: cognito.IUserPool;
    public readonly identityPool: cognito.CfnIdentityPool;
    public readonly userPoolClientWeb: cognito.UserPoolClient;
    public readonly authenticatedUserRole: iam.IRole;
    public readonly adminGroupRole: iam.IRole;
    public readonly operatorGroupRole: iam.IRole;
    public readonly commentatorGroupRole: iam.IRole;
    public readonly unauthenticated_user_role: iam.IRole;

    constructor(scope: Construct, id: string, props: IdpProps) {
        super(scope, id);

        const stack = cdk.Stack.of(this);

        const pre_sign_up_lambda = new lambdaPython.PythonFunction(this, 'pre_sign_up_lambda', {
            entry: 'lib/lambdas/cognito_triggers/',
            description: 'Cognito pre sign up Lambda',
            index: 'index.py',
            handler: 'pre_sign_up_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                eventbus_name: props.eventbus.eventBusName,
            },
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [
                props.lambdaConfig.layersConfig.helperFunctionsLayer,
                props.lambdaConfig.layersConfig.powerToolsLayer,
            ],
        });

        props.eventbus.grantPutEventsTo(pre_sign_up_lambda);

        const userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: stack.stackName,
            standardAttributes: {
                email: { required: true, mutable: true },
            },
            mfa: cognito.Mfa.OPTIONAL,
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            removalPolicy: RemovalPolicy.DESTROY,
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: true,
                requireUppercase: true,
                tempPasswordValidity: Duration.days(2),
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
            lambdaTriggers: { preSignUp: pre_sign_up_lambda },
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
        this.userPoolClientWeb = userPoolClientWeb;

        //  Cognito Identity Pool
        const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: userPoolClientWeb.userPoolClientId,
                    providerName: userPool.userPoolProviderName,
                },
            ],
        });

        this.identityPool = identityPool;

        // Cognito Identity Pool Authenitcated Role
        const authUserRole = new iam.Role(this, 'CognitoDefaultAuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal(
                'cognito-identity.amazonaws.com',
                {
                    StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
                    'ForAnyValue:StringLike': {
                        'cognito-identity.amazonaws.com:amr': 'authenticated',
                    },
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
        });
        this.authenticatedUserRole = authUserRole;

        console.info(userPool.userPoolProviderName); // TODO remove after test

        new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
            identityPoolId: identityPool.ref,
            roles: {
                authenticated: authUserRole.roleArn,
            },
            roleMappings: {
                mapping: {
                    type: 'Token',
                    identityProvider: `cognito-idp.${stack.region}.amazonaws.com/${userPool.userPoolId}:${userPoolClientWeb.userPoolClientId}`,
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
                    'ForAnyValue:StringLike': {
                        'cognito-identity.amazonaws.com:amr': 'authenticated',
                    },
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
                    'ForAnyValue:StringLike': {
                        'cognito-identity.amazonaws.com:amr': 'authenticated',
                    },
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
        });
        this.operatorGroupRole = operatorGroupRole;

        // Commentator Users Group Role
        const commentatorGroupRole = new iam.Role(this, 'CommentatorUserRole', {
            assumedBy: new iam.FederatedPrincipal(
                'cognito-identity.amazonaws.com',
                {
                    StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
                    'ForAnyValue:StringLike': {
                        'cognito-identity.amazonaws.com:amr': 'authenticated',
                    },
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
        });
        this.commentatorGroupRole = commentatorGroupRole;

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

        //  Cognito User Group (Commentator)
        const commentatorGroup = new cognito.CfnUserPoolGroup(this, 'CommentatorGroup', {
            userPoolId: userPool.userPoolId,
            description: 'Commentator user group',
            groupName: 'commentator',
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
    }
}

export interface CognitoUserProps {
    username: string;
    email: string;
    userPool: cognito.IUserPool;
    groupName?: string;
}

export class CognitoUser extends Construct {
    // Creates a user in the provided Cognito User pool

    constructor(scope: Construct, id: string, props: CognitoUserProps) {
        super(scope, id);

        const user = new cognito.CfnUserPoolUser(this, 'adminUser', {
            userPoolId: props.userPool.userPoolId,
            username: props.username,
            desiredDeliveryMediums: ['EMAIL'],
            userAttributes: [{ name: 'email', value: props.email }],
        });

        // If a Group Name is provided, also add the user to this Cognito UserPool Group
        if (props.groupName) {
            const userToGroupAttachment = new CfnUserPoolUserToGroupAttachment(
                this,
                'AdminUserToAdminGroup',
                {
                    userPoolId: user.userPoolId,
                    groupName: props.groupName,
                    username: user.username!,
                }
            );

            userToGroupAttachment.node.addDependency(user);
            userToGroupAttachment.node.addDependency(props.userPool);
        }
    }
}
