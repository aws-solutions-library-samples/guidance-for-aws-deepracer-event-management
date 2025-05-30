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
  EnumType,
  GraphqlType,
  InputType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

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
      appsyncHelpersLayer: lambda.ILayerVersion;
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
    const delete_user_function = new StandardLambdaPythonFunction(this, 'delete_user_function', {
      entry: 'lib/lambdas/delete_user_function/',
      description: 'Delete current user from cognito',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
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
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
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
    const users_handler = new StandardLambdaPythonFunction(this, 'users_handler', {
      entry: 'lib/lambdas/users_function/',
      description: 'Work with Cognito users',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
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
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });

    users_handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:ListUsers',
          'cognito-idp:ListGroups',
          'cognito-idp:ListUsersInGroup',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
        ],
        resources: [props.userPoolArn],
      })
    );

    // Define the data source for the API
    const users_data_source = props.appsyncApi.api.addLambdaDataSource('users_data_source', users_handler);

    NagSuppressions.addResourceSuppressions(
      users_data_source,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    const user_delete_data_source = props.appsyncApi.api.addLambdaDataSource(
      'user_delete_data_source',
      delete_user_function
    );

    NagSuppressions.addResourceSuppressions(
      user_delete_data_source,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [
            {
              regex: '/^Resource::(.+):\\*$/g',
            },
          ],
        },
      ],
      true
    );

    // Define API Schema
    const user_object_attributes = new ObjectType('UserObjectAttributes', {
      definition: {
        Name: GraphqlType.string({ isRequired: true }),
        Value: GraphqlType.string({ isRequired: true }),
      },
      directives: [Directive.cognito('admin', 'registration', 'commentator', 'operator'), Directive.iam()],
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

    const userRolesEnum = new EnumType('UserRolesType', {
      definition: ['admin', 'operator', 'commentator', 'registration', 'racer'],
    });
    props.appsyncApi.schema.addType(userRolesEnum);

    const user_object = new ObjectType('userObject', {
      definition: {
        Username: GraphqlType.string(),
        Attributes: user_object_attributes.attribute({ isList: true }),
        UserCreateDate: GraphqlType.awsDateTime(),
        UserLastModifiedDate: GraphqlType.awsDateTime(),
        Enabled: GraphqlType.boolean(),
        Roles: userRolesEnum.attribute({ isList: true }),
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
        args: {
          username_prefix: GraphqlType.string({ isRequired: false }),
        },
        returnType: user_object.attribute({ isList: true }),
        dataSource: users_data_source,
        directives: [Directive.iam(), Directive.cognito('admin', 'registration', 'operator')],
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
      'updateUser',
      new ResolvableField({
        args: {
          username: GraphqlType.string({ isRequired: true }),
          roles: GraphqlType.string({ isRequiredList: true }),
        },
        returnType: user_object.attribute(),
        dataSource: users_data_source,
        directives: [Directive.iam(), Directive.cognito('admin')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUserUpdated',
      new ResolvableField({
        returnType: user_object.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          `{
                        "version": "2017-02-28",
                        "payload": $util.toJson($context.arguments.entry)
                    }`
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateUser'), Directive.cognito('admin', 'operator')],
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
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
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
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('userCreated'), Directive.cognito('admin', 'registration', 'operator')],
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

    // Eventbus Functions //

    // respond to new user event
    const user_created_event_handler = new StandardLambdaPythonFunction(this, 'user_created_event_handler', {
      entry: 'lib/lambdas/users_function/',
      description: 'Work with Cognito users',
      index: 'user_created_event.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      environment: {
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        user_pool_id: props.userPoolId,
        POWERTOOLS_SERVICE_NAME: 'users_function',
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

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

    // respond to user confirmed event
    const user_confirmed_event_handler = new StandardLambdaPythonFunction(this, 'user_confirmed_event_handler', {
      entry: 'lib/lambdas/users_function/',
      description: 'Work with Cognito users',
      index: 'user_confirmed_event.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      environment: {
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
        POWERTOOLS_SERVICE_NAME: 'users_confirmed_function',
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
      ],
    });

    props.appsyncApi.api.grantMutation(user_confirmed_event_handler, 'updateUser');

    // EventBridge Rule
    const confirmedRule = new Rule(this, 'user_confirmed_event_handler_rule', {
      eventBus: props.eventbus,
    });
    confirmedRule.addEventPattern({
      source: ['idp'],
      detailType: ['userConfirmed'],
    });
    confirmedRule.addTarget(new targets.LambdaFunction(user_confirmed_event_handler));
  }
}
