import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import { DockerImage, Duration } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
    CodeFirstSchema,
    Directive,
    GraphqlType,
    ObjectType,
    ResolvableField,
} from 'awscdk-appsync-utils';
import { Construct } from 'constructs';

export interface GroupManagerProps {
    userPoolId: string;
    userPoolArn: string;
    userApiObject: ObjectType;
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
}

export class GroupManager extends Construct {
    // public readonly origin: cloudfront.IOrigin;
    // public readonly sourceBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: GroupManagerProps) {
        super(scope, id);

        // GET groups users Function
        const groupsApiFunction = new lambdaPython.PythonFunction(this, 'groupsApiFunction', {
            entry: 'lib/lambdas/groups_api/',
            description: 'Group administration',
            index: 'index.py',
            handler: 'lambda_handler',
            timeout: Duration.minutes(1),
            runtime: props.lambdaConfig.runtime,
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            architecture: props.lambdaConfig.architecture,
            environment: {
                user_pool_id: props.userPoolId,
                POWERTOOLS_SERVICE_NAME: 'groups_api',
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
        groupsApiFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'cognito-idp:ListUsersInGroup',
                    'cognito-idp:AdminAddUserToGroup',
                    'cognito-idp:AdminRemoveUserFromGroup',

                    'cognito-idp:ListGroups',
                    'cognito-idp:CreateGroup',
                    'cognito-idp:DeleteGroup',
                ],
                resources: [props.userPoolArn],
            })
        );

        const groupsDataSource = props.appsyncApi.api.addLambdaDataSource(
            'groupsDataSource',
            groupsApiFunction
        );

        const groupObject = new ObjectType('GroupObject', {
            definition: {
                GroupName: GraphqlType.string(),
                Description: GraphqlType.string(),
            },
            directives: [Directive.cognito('admin')],
        });

        props.appsyncApi.schema.addType(groupObject);

        props.appsyncApi.schema.addQuery(
            'listGroups',
            new ResolvableField({
                returnType: groupObject.attribute({ isList: true }),
                dataSource: groupsDataSource,
                directives: [Directive.cognito('admin')],
            })
        );

        props.appsyncApi.schema.addQuery(
            'getGroupMembers',
            new ResolvableField({
                args: {
                    GroupName: GraphqlType.string({ isRequired: true }),
                },
                returnType: props.userApiObject.attribute({ isList: true }),
                dataSource: groupsDataSource,
                directives: [Directive.cognito('admin')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'deleteUserFromGroup',
            new ResolvableField({
                args: {
                    Username: GraphqlType.string({ isRequired: true }),
                    GroupName: GraphqlType.string({ isRequired: true }),
                },
                returnType: props.userApiObject.attribute(),
                dataSource: groupsDataSource,
                directives: [Directive.cognito('admin')],
            })
        );

        props.appsyncApi.schema.addMutation(
            'addUserToGroup',
            new ResolvableField({
                args: {
                    Username: GraphqlType.string({ isRequired: true }),
                    GroupName: GraphqlType.string({ isRequired: true }),
                },
                returnType: props.userApiObject.attribute(),
                dataSource: groupsDataSource,
                directives: [Directive.cognito('admin')],
            })
        );
    }
}
