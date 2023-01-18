import * as cdk from 'aws-cdk-lib';
import { DockerImage } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';
import { CarManager } from './constructs/cars-manager';
import { CwRumAppMonitor } from './constructs/cw-rum';
import { EventsManager } from './constructs/events-manager';
import { GroupManager } from './constructs/group-manager';
import { LabelPrinter } from './constructs/label-printer';
import { Leaderboard } from './constructs/leaderboard-construct';
import { ModelsManager } from './constructs/models-manager';
import { RestApi } from './constructs/rest-api';
import { SystemsManager } from './constructs/systems-manager';
import { UserManager } from './constructs/user-manager';
import { Website } from './constructs/website';


export interface DeepracerEventManagerStackProps extends cdk.StackProps {
  adminGroupRole: IRole,
  operatorGroupRole: IRole,
  userPool: IUserPool,
  cloudfrontDistribution: IDistribution
  logsBucket: IBucket
  lambdaConfig: { // TODO Break out to it´s own class/struct etc
    runtime: lambda.Runtime,
    architecture: lambda.Architecture,
    bundlingImage: DockerImage
    layersConfig: {
      powerToolsLogLevel: string
      helperFunctionsLayer: lambda.ILayerVersion
      powerToolsLayer: lambda.ILayerVersion
    }
  }
}

export class DeepracerEventManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DeepracerEventManagerStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this)

      // Appsync API
    const schema = new CodeFirstSchema()
    const appsyncApi = new appsync.GraphqlApi(this, 'graphQlApi', {
      name: `api-${stack.stackName}`,
      schema: schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM
        }
      },
      xrayEnabled: true,
      logConfig: {
        retention: RetentionDays.ONE_WEEK
      }
    })

    const noneDataSoure = appsyncApi.addNoneDataSource("none")

    // Rest API - API GW
    const restApi = new RestApi(this, "restApi", {
      cloudFrontDistributionName: props.cloudfrontDistribution.distributionDomainName,
    })

    const modelsManager = new ModelsManager(this, 'ModelsManager', {
      adminGroupRole: props.adminGroupRole,
      operatorGroupRole: props.operatorGroupRole,
      appsyncApi: {
        api: appsyncApi,
        schema: schema,
        noneDataSource: noneDataSoure
      },
      lambdaConfig: props.lambdaConfig,
      logsBucket: props.logsBucket,
      restApi: {
        api: restApi.api,
        apiAdminResource: restApi.apiAdminResource,
        bodyValidator: restApi.bodyValidator,
        instanceidCommandIdModel: restApi.instanceidCommandidModel
      }
    })

    // Terms And Conditions
    const tncWebsite = new Website(this, "TermsNConditions", {
      contentPath: "./lib/constructs/terms_n_conditions/webpage/",
      logsBucket: props.logsBucket
    })

    // TODO NOT WORLKING - CIRCULAR DEPENDENCY
    // props.cloudfrontDistribution.addBehavior(
    //     path_pattern="terms_and_conditions.html", origin=tnc_website.origin
    // )

    const carManager = new CarManager(this, 'CarManager', {
      adminGroupRole: props.adminGroupRole,
      appsyncApi: {
        api: appsyncApi,
        schema: schema
      },
      lambdaConfig: props.lambdaConfig
    })

    new EventsManager(this, 'EventsManager', {
      adminGroupRole: props.adminGroupRole,
      appsyncApi: {
        api: appsyncApi,
        schema: schema,
        noneDataSource: noneDataSoure
      },
      userPoolId: props.userPool.userPoolId,
      lambdaConfig: props.lambdaConfig
    })

    new Leaderboard(this, 'Leaderboard', {
      adminGroupRole: props.adminGroupRole,
      appsyncApi: {
        api: appsyncApi,
        schema: schema,
        noneDataSource: noneDataSoure
      },
      lambdaConfig: props.lambdaConfig,
      userPoolArn: props.userPool.userPoolArn,
      userPoolId: props.userPool.userPoolId
    })

    new SystemsManager(this, 'SystemManager')

    new GroupManager(this, 'GroupManagers', {
      adminGroupRole: props.adminGroupRole,
      appsyncApi: {
        api: appsyncApi,
        schema: schema,
      },
      lambdaConfig: props.lambdaConfig,
      userPoolArn: props.userPool.userPoolArn,
      userPoolId: props.userPool.userPoolId,
      restApi: {
        api: restApi.api,
        apiAdminResource: restApi.apiAdminResource,
        bodyValidator: restApi.bodyValidator,
      }
    })

    new UserManager(this, 'UserManager', {
      adminGroupRole: props.adminGroupRole,
      lambdaConfig: props.lambdaConfig,
      userPoolArn: props.userPool.userPoolArn,
      userPoolId: props.userPool.userPoolId,
      restApi: {
        api: restApi.api,
        apiAdminResource: restApi.apiAdminResource,
        bodyValidator: restApi.bodyValidator,
      }
    })

    new LabelPrinter(this, 'LabelPrinter', {
      adminGroupRole: props.adminGroupRole,
      lambdaConfig: props.lambdaConfig,
      logsbucket: props.logsBucket,
      restApi: {
        api: restApi.api,
        apiAdminResource: restApi.apiAdminResource,
        bodyValidator: restApi.bodyValidator,
        instanceidCommandIdModel: restApi.instanceidCommandidModel,
        apiCarsUploadResource: modelsManager.apiCarsUploadResource
      }
    })

    const cwRumAppMonitor = new CwRumAppMonitor( this, "CwRumAppMonitor", {
      domainName: props.cloudfrontDistribution.distributionDomainName
    })

  }
}
