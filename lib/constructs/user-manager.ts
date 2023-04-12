import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    InputType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';

import { Construct } from 'constructs';

export interface UserManagerProps {
    authenticatedUserRole: IRole;
    userPoolId: string;
    userPoolArn: string;
    appsyncApi: {
        schema: CodeFirstSchema;
        api: appsync.GraphqlApi;
        noneDataSource: appsync.NoneDataSource;
    };
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

export class UserManager extends Construct {
    // public readonly origin: cloudfront.IOrigin;
    // public readonly sourceBucket: s3.IBucket;
    public readonly userApiObject: ObjectType;

    constructor(scope: Construct, id: string, props: UserManagerProps) {
        super(scope, id);

        // delete users Function
        const delete_user_function = new lambdaPython.PythonFunction(this, 'delete_user_function', {
            entry: 'lib/lambdas/delete_user_function/',
            description: 'Delete current user from cognito',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'delete_user',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
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
        delete_user_function.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:AdminDeleteUser', 'cognito-idp:AdminGetUser'],
                resources: [props.userPoolArn],
            })
        );
        props.eventbus.grantPutEventsTo(delete_user_function);

        // API RESOURCES
        // List & create users Function
        const users_handler = new lambdaPython.PythonFunction(this, 'users_handler', {
            entry: 'lib/lambdas/users_function/',
            description: 'Work with Cognito users',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'cognito_users',
                LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
            },
            bundling: {
                image: props.lambdaConfig.bundlingImage,
            },
            layers: [
                props.lambdaConfig.layersConfig.helperFunctionsLayer,
                props.lambdaConfig.layersConfig.powerToolsLayer,
            ],
        });

        users_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminCreateUser'],
                resources: [props.userPoolArn],
            })
        );

        // Define the data source for the API
        const users_data_source = props.appsyncApi.api.addLambdaDataSource(
            'users_data_source',
            users_handler
        );
        const user_delete_data_source = props.appsyncApi.api.addLambdaDataSource(
            'user_delete_data_source',
            delete_user_function
        );

        // Define API Schema
        const user_object_attributes = new ObjectType('UserObjectAttributes', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
            directives: [
                Directive.cognito('admin', 'registration', 'commentator', 'operator'),
                Directive.iam(),
            ],
        });

        props.appsyncApi.schema.addType(user_object_attributes);

        const user_object_attributes_input = new InputType('UserObjectAttributesInput', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
            directives: [Directive.iam()],
        });

        props.appsyncApi.schema.addType(user_object_attributes_input);

        const user_object_mfa_options = new ObjectType('UsersObjectMfaOptions', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
            directives: [Directive.cognito('admin', 'registration', 'operator'), Directive.iam()],
        });

        props.appsyncApi.schema.addType(user_object_mfa_options);

        const user_object_mfa_options_input = new InputType('UsersObjectMfaOptionsInput', {
            definition: {
                Name: GraphqlType.string({ isRequired: true }),
                Value: GraphqlType.string({ isRequired: true }),
            },
            directives: [Directive.iam()],
        });

        props.appsyncApi.schema.addType(user_object_mfa_options_input);

        const user_object = new ObjectType('userObject', {
            definition: {
                Username: GraphqlType.string(),
                Attributes: user_object_attributes.attribute({ isList: true }),
                UserCreateDate: GraphqlType.awsDateTime(),
                UserLastModifiedDate: GraphqlType.awsDateTime(),
                Enabled: GraphqlType.boolean(),
                UserStatus: GraphqlType.string(),
                MFAOptions: user_object_mfa_options.attribute({ isList: true, isRequired: false }),
                sub: GraphqlType.id({ isRequired: false }),
            },
            directives: [Directive.cognito('admin', 'registration', 'operator'), Directive.iam()],
        });

        props.appsyncApi.schema.addType(user_object);
        this.userApiObject = user_object;

        const user_delete_object = new ObjectType('userDeleteObject', {
            definition: {
                Username: GraphqlType.string(),
                Deleted: GraphqlType.boolean(),
            },
            // all users shall be able to delete themself
        });

        props.appsyncApi.schema.addType(user_delete_object);

        // Event methods
        props.appsyncApi.schema.addQuery(
            'listUsers',
            new ResolvableField({
                returnType: user_object.attribute({ isList: true }),
                dataSource: users_data_source,
                directives: [Directive.cognito('admin', 'registration', 'operator')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'createUser',
            new ResolvableField({
                args: {
                    username: GraphqlType.string({ isRequired: true }),
                    email: GraphqlType.string({ isRequired: true }),
                    countryCode: GraphqlType.string({ isRequired: true }),
                },
                returnType: user_object.attribute(),
                dataSource: users_data_source,
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    `#if (!$util.isNull($context.result.error))
                        $util.error($context.result.error.message, $ctx.result.error.type)
                    #end

                    $utils.toJson($context.result)`
                ),
                directives: [Directive.cognito('admin', 'registration')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'deleteUser',
            new ResolvableField({
                args: {
                    username: GraphqlType.string({ isRequired: true }),
                },
                returnType: user_delete_object.attribute(),
                dataSource: user_delete_data_source,
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    `#if (!$util.isNull($context.result.error))
                        $util.error($context.result.error.message, $ctx.result.error.type)
                    #end
                    $utils.toJson($context.result)`
                ),
                // directive: all users shall be able to delete themself
            })
        );

        props.appsyncApi.schema.addMutation(
            'userCreated',
            new ResolvableField({
                args: {
                    Username: GraphqlType.string(),
                    Attributes: user_object_attributes_input.attribute({ isList: true }),
                    UserCreateDate: GraphqlType.awsDateTime(),
                    UserLastModifiedDate: GraphqlType.awsDateTime(),
                    Enabled: GraphqlType.boolean(),
                    UserStatus: GraphqlType.string(),
                    MFAOptions: user_object_mfa_options_input.attribute({
                        isList: true,
                        isRequired: false,
                    }),
                    sub: GraphqlType.id({ isRequired: false }),
                },
                returnType: user_object.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                    "payload": $util.toJson($context.arguments)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [Directive.iam()],
            })
        );

        props.appsyncApi.schema.addSubscription(
            'onUserCreated',
            new ResolvableField({
                returnType: user_object.attribute(),
                dataSource: props.appsyncApi.noneDataSource,
                requestMappingTemplate: appsync.MappingTemplate.fromString(
                    `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
                ),
                responseMappingTemplate: appsync.MappingTemplate.fromString(
                    '$util.toJson($context.result)'
                ),
                directives: [
                    Directive.subscribe('userCreated'),
                    Directive.cognito('admin', 'registration', 'operator'),
                ],
            })
        );

        // Grant access so API methods can be invoked
        const user_api_policy = new iam.Policy(this, 'userApiPolicy', {
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['appsync:GraphQL'],
                    resources: [`${props.appsyncApi.api.arn}/types/Mutation/fields/deleteUser`],
                }),
            ],
        });
        user_api_policy.attachToRole(props.authenticatedUserRole);

        const requestsAws4authLayer = new lambdaPython.PythonLayerVersion(
            this,
            'requestsAws4authLayer',
            {
                entry: 'lib/lambdas/helper_functions_layer/requests_aws4auth/',
                compatibleArchitectures: [props.lambdaConfig.architecture],
                compatibleRuntimes: [props.lambdaConfig.runtime],
                bundling: { image: props.lambdaConfig.bundlingImage },
            }
        );

        // Eventbus Functions //

        // respond to new user event
        const user_created_event_handler = new lambdaPython.PythonFunction(
            this,
            'user_created_event_handler',
            {
                entry: 'lib/lambdas/users_function/',
                description: 'Work with Cognito users',
                index: 'user_created_event.py',
                handler: 'lambda_handler',
                timeout: Duration.minutes(1),
                runtime: props.lambdaConfig.runtime,
                tracing: lambda.Tracing.ACTIVE,
                memorySize: 128,
                architecture: props.lambdaConfig.architecture,
                environment: {
                    graphqlUrl: props.appsyncApi.api.graphqlUrl,
                    user_pool_id: props.userPoolId,
                },
                bundling: {
                    image: props.lambdaConfig.bundlingImage,
                },
                layers: [
                    props.lambdaConfig.layersConfig.helperFunctionsLayer,
                    props.lambdaConfig.layersConfig.powerToolsLayer,
                    requestsAws4authLayer,
                ],
            }
        );

        props.appsyncApi.api.grantMutation(user_created_event_handler, 'userCreated');

        user_created_event_handler.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['cognito-idp:ListUsers'],
                resources: [props.userPoolArn],
            })
        );

        // EventBridge Rule
        const rule = new Rule(this, 'user_created_event_handler_rule', {
            eventBus: props.eventbus,
        });
        rule.addEventPattern({
            source: ['idp'],
            detailType: ['userCreated'],
        });
        rule.addTarget(new targets.LambdaFunction(user_created_event_handler));
    }
}
