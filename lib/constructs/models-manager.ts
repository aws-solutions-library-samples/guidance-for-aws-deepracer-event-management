import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  CodeFirstSchema,
  Directive,
  EnumType,
  GraphqlType,
  InputType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { CarUploadStepFunction } from './models-manager-car-upload-step-function';

export interface ModelsManagerProps {
  adminGroupRole: IRole;
  operatorGroupRole: IRole;
  authenticatedUserRole: IRole;
  logsBucket: IBucket;
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

export class ModelsManager extends Construct {
  public readonly uploadBucket: s3.Bucket;
  public readonly modelsBucket: s3.Bucket;
  public readonly apiCarsUploadResource: apig.Resource;

  constructor(scope: Construct, id: string, props: ModelsManagerProps) {
    super(scope, id);

    // staging Bucket for all incoming models
    const uploadBucket = new s3.Bucket(this, 'upload_bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/upload_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { expiration: Duration.days(15), tagFilters: { lifecycle: 'true' } },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });
    this.uploadBucket = uploadBucket;

    // Models S3 bucket
    const modelsBucket = new s3.Bucket(this, 'models_bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED, // TODO change to KMS encryption CMK
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/models_bucket/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { expiration: Duration.days(15), tagFilters: { lifecycle: 'true' } },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });
    this.modelsBucket = modelsBucket;

    // Models table, used by deleteInfectedFilesFunction and also models_manager
    const modelsTable = new dynamodb.Table(this, 'ModelsDataTableV2', {
      partitionKey: {
        name: 'sub',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'modelId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const OPERATOR_MODELS_GSI_NAME = 'operatorAvailableModelsIndexV2';
    modelsTable.addGlobalSecondaryIndex({
      indexName: OPERATOR_MODELS_GSI_NAME,
      partitionKey: {
        name: 'gsiAvailableForOperator',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gsiUploadedTimestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // upload_model_to_car_function
    const uploadModelToCarFunctionLambda = new StandardLambdaPythonFunction(this, 'uploadModelToCarFunctionLambda', {
      entry: 'lib/lambdas/upload_model_to_car_function/',
      description: 'prepares the SSM call for uploading a model to a car',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      environment: {
        MODELS_S3_BUCKET: modelsBucket.bucketName,
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });
    uploadModelToCarFunctionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetCommandInvocation', 'ssm:SendCommand'],
        resources: ['*'],
      })
    );

    // upload_model_to_car_function
    const uploadModelToCarStatusLambda = new StandardLambdaPythonFunction(this, 'uploadModelToCarStatusLambda', {
      entry: 'lib/lambdas/upload_model_to_car_status_function/',
      description: 'Returns the status uploading a model to a car',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'upload_model_to_car_status',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });

    uploadModelToCarStatusLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetCommandInvocation'],
        resources: ['*'],
      })
    );
    // permissions for s3 bucket read
    modelsBucket.grantRead(uploadModelToCarFunctionLambda, 'private/*');

    const corsRule = {
      allowedHeaders: ['*'],
      allowedMethods: [
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
        s3.HttpMethods.DELETE,
      ],
      allowedOrigins: [
        '*',
        // "http://localhost:3000",
        // "https://" + distribution.distribution_domain_name
      ],
      exposedHeaders: ['x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2', 'ETag'],
      maxAge: 3000,
    };
    uploadBucket.addCorsRule(corsRule);

    const getModelsPolicy = new iam.Policy(this, 'modelApiPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:get*'],
          resources: [`${modelsBucket.bucketArn}/*`],
        }),
      ],
    });
    getModelsPolicy.attachToRole(props.adminGroupRole);
    getModelsPolicy.attachToRole(props.operatorGroupRole);

    const modelsOnUploadHandler = new StandardLambdaPythonFunction(this, 'OnUploadFunction', {
      entry: 'lib/lambdas/models_on_upload/',
      description: 'creates initial DynamoDB entry for uploaded model',
      runtime: props.lambdaConfig.runtime,
      memorySize: 256,
      environment: {
        DDB_TABLE: modelsTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'models_on_upload',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
    });

    const uploadLambdaFctS3ObjectCreatedRule = new Rule(this, 'ModelsOnUploadFctS3ObjectCreated', {
      description: 'Calls Lambda function for models uploaded to S3',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [uploadBucket.bucketName],
          },
        },
      },
      targets: [new LambdaFunction(modelsOnUploadHandler)],
    });

    props.appsyncApi.api.grantMutation(modelsOnUploadHandler, 'addModel');

    const modelsMd5Handler = new StandardLambdaPythonFunction(this, 'ModelsMd5Function', {
      entry: 'lib/lambdas/models_md5/',
      description: 'calculates Model MD5 and extracts Model Metadata',
      runtime: props.lambdaConfig.runtime,
      memorySize: 256,
      environment: {
        DDB_TABLE: modelsTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'models_md5',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
    });

    const md5LambdaFctS3ObjectCreatedRule = new Rule(this, 'MD5OnUploadFctS3ObjectCreated', {
      description: 'Calls Lambda function for models moved to final folder',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [modelsBucket.bucketName],
          },
        },
      },
      targets: [new LambdaFunction(modelsMd5Handler)],
    });

    modelsBucket.grantRead(modelsMd5Handler, 'private/*');
    props.appsyncApi.api.grantMutation(modelsMd5Handler, 'updateModel');

    const modelsOnDeleteHandler = new StandardLambdaPythonFunction(this, 'OnDeleteHandler', {
      entry: 'lib/lambdas/models_on_delete/',
      description: 'Generates a deleteModel mutation to delete the model in the db as well as pushing update to FE',
      runtime: props.lambdaConfig.runtime,
      architecture: props.lambdaConfig.architecture,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'models_on_delete',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        APPSYNC_URL: props.appsyncApi.api.graphqlUrl,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.appsyncHelpersLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
    });

    const deleteLambdaFctS3ObjectDeleteRule = new Rule(this, 'DeleteLambdaFctS3ObjectDeleteRule', {
      description: 'Calls Lambda function for models deleted from S3',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Deleted'],
        detail: {
          bucket: {
            name: [modelsBucket.bucketName],
          },
        },
      },
      targets: [new LambdaFunction(modelsOnDeleteHandler)],
    });

    props.appsyncApi.api.grantMutation(modelsOnDeleteHandler, 'deleteModel');
    modelsTable.grantReadWriteData(modelsOnDeleteHandler);

    // loged in user can only read/write their own bucket
    const ownModelsPolicy = new iam.Policy(this, 'userAccessToOwnModels', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:PutObjectTagging'],
          resources: [
            uploadBucket.bucketArn + '/private/${cognito-identity.amazonaws.com:sub}',
            uploadBucket.bucketArn + '/private/${cognito-identity.amazonaws.com:sub}/*',
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListBucket'],
          resources: [uploadBucket.bucketArn],
          conditions: {
            StringLike: {
              's3:prefix': ['private/${cognito-identity.amazonaws.com:sub}/*'],
            },
          },
        }),
      ],
    });
    ownModelsPolicy.attachToRole(props.authenticatedUserRole);
    ownModelsPolicy.attachToRole(props.adminGroupRole);
    ownModelsPolicy.attachToRole(props.operatorGroupRole);

    // Permissions for DynamoDB read / write
    modelsTable.grantReadWriteData(modelsOnUploadHandler);

    // Permissions for s3 bucket read / write
    modelsBucket.grantReadWrite(modelsOnUploadHandler, 'private/*');

    const modelsHandler = new StandardLambdaPythonFunction(this, 'ApiFunction', {
      entry: 'lib/lambdas/models_api/',
      description: 'Models API resolver',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(1),
      runtime: props.lambdaConfig.runtime,
      memorySize: 128,
      architecture: props.lambdaConfig.architecture,
      environment: {
        DDB_TABLE: modelsTable.tableName,
        OPERATOR_MODELS_GSI_NAME: OPERATOR_MODELS_GSI_NAME,
        POWERTOOLS_SERVICE_NAME: 'models API resolver',
        LOG_LEVEL: props.lambdaConfig.layersConfig.powerToolsLogLevel,
        MODELS_S3_BUCKET: modelsBucket.bucketName,
        EVENT_BUS_NAME: props.eventbus.eventBusName,
      },
      bundling: {
        image: props.lambdaConfig.bundlingImage,
      },
      layers: [props.lambdaConfig.layersConfig.helperFunctionsLayer, props.lambdaConfig.layersConfig.powerToolsLayer],
    });

    modelsTable.grantReadWriteData(modelsHandler);
    modelsBucket.grantRead(modelsHandler, 'private/*');
    props.eventbus.grantPutEventsTo(modelsHandler);

    // Define the data source for the API
    const modelsDataSource = props.appsyncApi.api.addLambdaDataSource('ModelsDataSource', modelsHandler);

    NagSuppressions.addResourceSuppressions(
      modelsDataSource,
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

    // GraphQL API
    const modelStatusEnum = new EnumType('ModelStatusEnum', {
      definition: ['UPLOADED', 'NOT_VALID', 'QUARANTINED', 'AVAILABLE', 'DELETED'],
    });
    props.appsyncApi.schema.addType(modelStatusEnum);

    const fileMetadataObjectType = new ObjectType('FileMetadata', {
      definition: {
        key: GraphqlType.string(),
        filename: GraphqlType.string(),
        uploadedDateTime: GraphqlType.awsDateTime(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(fileMetadataObjectType);

    const fileMetadataInputType = new InputType('FileMetadataInput', {
      definition: {
        key: GraphqlType.string(),
        filename: GraphqlType.string(),
        uploadedDateTime: GraphqlType.awsDateTime(),
      },
    });

    props.appsyncApi.schema.addType(fileMetadataInputType);

    const modelMetadataObjectType = new ObjectType('ModelMetadata', {
      definition: {
        sensor: GraphqlType.string({ isList: true }),
        actionSpaceType: GraphqlType.string(),
        trainingAlgorithm: GraphqlType.string(),
        metadataMd5: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(modelMetadataObjectType);

    const modelMetadataInputType = new InputType('ModelMetadataInput', {
      definition: {
        sensor: GraphqlType.string({ isList: true }),
        actionSpaceType: GraphqlType.string(),
        trainingAlgorithm: GraphqlType.string(),
        metadataMd5: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(modelMetadataInputType);

    const modelObjectType = new ObjectType('Model', {
      definition: {
        sub: GraphqlType.id({ isRequired: true }),
        username: GraphqlType.string(),
        modelId: GraphqlType.string({ isRequired: true }),
        modelname: GraphqlType.string(),
        fileMetaData: fileMetadataObjectType.attribute(),
        modelMetaData: modelMetadataObjectType.attribute(),
        modelMD5: GraphqlType.string(),
        status: modelStatusEnum.attribute(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(modelObjectType);

    const modelObjectPagination = new ObjectType('ModelPagination', {
      definition: {
        models: modelObjectType.attribute({ isList: true }),
        nextToken: GraphqlType.string(),
      },
      directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator', 'commentator')], // TODO anyone who is logged in should have access to this
    });

    props.appsyncApi.schema.addType(modelObjectPagination);

    const carUploadStepFunction = new CarUploadStepFunction(this, 'CarUploadStepFunction', modelsBucket, props);

    props.appsyncApi.schema.addQuery(
      'getAllModels',
      new ResolvableField({
        args: {
          limit: GraphqlType.int({ isRequired: false }),
          nextToken: GraphqlType.string({ isRequired: false }),
        },
        returnType: modelObjectPagination.attribute(),
        dataSource: modelsDataSource,
        directives: [Directive.cognito('admin', 'operator', 'racer', 'commentator')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'addModel',
      new ResolvableField({
        args: {
          sub: GraphqlType.id({ isRequired: true }),
          username: GraphqlType.string({ isRequired: true }),
          modelId: GraphqlType.id({ isRequired: true }),
          modelname: GraphqlType.string(),
          fileMetaData: fileMetadataInputType.attribute(),
          modelMetaData: modelMetadataInputType.attribute(),
          modelMD5: GraphqlType.string(),
          status: modelStatusEnum.attribute({ isRequired: true }),
        },
        returnType: modelObjectType.attribute(),
        dataSource: modelsDataSource,
        directives: [Directive.iam()],
      })
    );

    // Allow users in operator or admin groups to subscribe to all model updates
    // Allow users not in these groups to subscribe only to their own model updates
    const subscriptionPermissions = `
        #set($groups = $context.identity.claims.get("cognito:groups"))
        #set($isOperator = false)

        #foreach($group in $groups)
            #if($group == "operator" || $group == "admin")
                #set($isOperator = true)
            #end
        #end

        #if($context.identity.sub == $context.args.sub)
            {
            "version": "2018-05-29",
            "payload": $util.toJson($context.arguments.entry)
        }
        #elseif($isOperator == true)
            {
            "version": "2018-05-29",
            "payload": $util.toJson($context.arguments.entry)
        }
        #else
            $utils.unauthorized()
        #end
        `;

    props.appsyncApi.schema.addSubscription(
      'onAddedModel',
      new ResolvableField({
        args: {
          sub: GraphqlType.id(),
        },
        returnType: modelObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(subscriptionPermissions),
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          `
            $util.toJson($context.result)
            `
        ),
        directives: [Directive.subscribe('addModel')], // , Directive.cognito('admin')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'updateModel',
      new ResolvableField({
        args: {
          modelId: GraphqlType.id({ isRequired: true }),
          sub: GraphqlType.id({ isRequired: true }),
          username: GraphqlType.string(),
          modelname: GraphqlType.string(),
          fileMetaData: fileMetadataInputType.attribute(),
          modelMetaData: modelMetadataInputType.attribute(),
          modelMD5: GraphqlType.string(),
          status: modelStatusEnum.attribute(),
        },
        returnType: modelObjectType.attribute(),
        dataSource: modelsDataSource,
        directives: [Directive.iam()],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onUpdatedModel',
      new ResolvableField({
        args: {
          sub: GraphqlType.id(),
        },
        returnType: modelObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(subscriptionPermissions),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('updateModel')],
      })
    );

    props.appsyncApi.schema.addMutation(
      'deleteModel',
      new ResolvableField({
        args: {
          modelId: GraphqlType.id({ isRequired: true }),
          sub: GraphqlType.id(),
        },
        returnType: modelObjectType.attribute(),
        dataSource: modelsDataSource,
        directives: [Directive.iam(), Directive.cognito('racer', 'admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addSubscription(
      'onDeletedModel',
      new ResolvableField({
        args: {
          sub: GraphqlType.id(),
        },
        returnType: modelObjectType.attribute(),
        dataSource: props.appsyncApi.noneDataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(subscriptionPermissions),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.subscribe('deleteModel')],
      })
    );
    // GraphQL upload model to car
    const uploadModelToCarInputType = new InputType('UploadModelToCarInput', {
      definition: {
        carInstanceId: GraphqlType.string(),
        modelKey: GraphqlType.string(),
        username: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(uploadModelToCarInputType);

    const uploadModelToCarType = new ObjectType('UploadModelToCar', {
      definition: {
        carInstanceId: GraphqlType.string(),
        modelId: GraphqlType.string(),
        ssmCommandId: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(uploadModelToCarType);

    const uploadModelToCarStatusType = new ObjectType('UploadModelToCarStatus', {
      definition: {
        carInstanceId: GraphqlType.string(),
        ssmCommandId: GraphqlType.string(),
        ssmCommandStatus: GraphqlType.string(),
      },
    });

    props.appsyncApi.schema.addType(uploadModelToCarStatusType);

    const uploadModelToCarStatusDataSource = props.appsyncApi.api.addLambdaDataSource(
      'uploadModelToCarStatusDataSource',
      uploadModelToCarStatusLambda
    );

    NagSuppressions.addResourceSuppressions(
      uploadModelToCarStatusDataSource,
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

    const uploadModelToCarDataSource = props.appsyncApi.api.addLambdaDataSource(
      'uploadModelToCarDataSource',
      uploadModelToCarFunctionLambda
    );

    NagSuppressions.addResourceSuppressions(
      uploadModelToCarDataSource,
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

    props.appsyncApi.schema.addMutation(
      'uploadModelToCar',
      new ResolvableField({
        args: {
          entry: uploadModelToCarInputType.attribute({ isRequired: true }),
        },
        returnType: uploadModelToCarType.attribute(),
        dataSource: uploadModelToCarDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );

    props.appsyncApi.schema.addQuery(
      'getUploadModelToCarStatus',
      new ResolvableField({
        args: {
          carInstanceId: GraphqlType.string({ isRequired: true }),
          ssmCommandId: GraphqlType.string({ isRequired: true }),
        },
        returnType: uploadModelToCarStatusType.attribute(),
        dataSource: uploadModelToCarStatusDataSource,
        directives: [Directive.iam(), Directive.cognito('admin', 'operator')],
      })
    );
  }
}
