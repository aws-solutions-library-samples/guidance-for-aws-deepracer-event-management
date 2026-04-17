import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import * as awsLambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import * as os from 'os';
import { Cdn } from './constructs/cdn';
import { Eventbridge } from './constructs/eventbridge';
import { Idp } from './constructs/idp';
import { Website } from './constructs/website';

const WAF_IP_RATE_LIMIT = 1000; // number of allowed reuested per 5 minute per IP
export interface BaseStackProps extends cdk.StackProps {
  email: string;
  labelName: string;
  domainName?: string;
}

export class BaseStack extends cdk.Stack {
  public readonly eventbridge: Eventbridge;
  public readonly idp: Idp;
  public readonly cloudfrontDistribution: Distribution;
  public readonly cloudfrontDomainNames?: string[];
  public readonly logsBucket: s3.Bucket;
  public readonly lambdaConfig: {
    runtime: awsLambda.Runtime;
    architecture: awsLambda.Architecture;
    bundlingImage: DockerImage;
  };
  public readonly dremWebsitebucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const stack = cdk.Stack.of(this);

    const logsBucket = new s3.Bucket(this, 'logsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsPrefix: 'access-logs/logsBucket/', // TODO is this causing a delete issue??
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [{ expiration: Duration.days(30) }, { abortIncompleteMultipartUploadAfter: Duration.days(1) }],
    });
    this.logsBucket = logsBucket;
    logsBucket.policy?.document.addStatements(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AllowSSLRequestsOnly',
        effect: cdk.aws_iam.Effect.DENY,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [logsBucket.bucketArn, logsBucket.bucketArn + '/*'],
        conditions: { NumericLessThan: { 's3:TlsVersion': '1.2' } },
      })
    );

    // Web Application Firewall
    const wafWebAclRegional = this.webApplicationFirewall(WAF_IP_RATE_LIMIT);

    // Cloudfront resources for serving multiple pages via the same distribution
    const dremWebsite = new Website(this, 'DremWebSite', {
      logsBucket: logsBucket,
    });

    this.dremWebsitebucket = dremWebsite.sourceBucket;

    // Required variables for setting up CloudFront
    let certificate: acm.ICertificate | undefined;
    let siteSubdomain = 'drem';
    let siteDomain: string[] | undefined;
    let hostedZone;

    // If the label is not main, we need to add it to the subdomain
    if (props.labelName && props.labelName !== 'main') {
      siteSubdomain = `${siteSubdomain}-${props.labelName}`;
    }

    if (props.domainName) {
      siteDomain = [`${siteSubdomain}.${props.domainName}`];
      this.cloudfrontDomainNames = siteDomain;
      // If you have a hosted zone in Route 53, you can look it up
      hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.domainName,
      });

      // Create a certificate for the domain (in us-east-1 for CloudFront)
      certificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
        domainName: siteDomain[0],
        hostedZone: hostedZone,
        region: 'us-east-1', // CloudFront requires certificates in us-east-1
      });
    }
    //  cloudfront Distribution
    const cdn = new Cdn(this, 'cdn', {
      defaultOrigin: dremWebsite.origin,
      logsBucket: logsBucket,
      domainNames: siteDomain,
      certificate: certificate,
      comment: 'DREM main website',
    });
    this.cloudfrontDistribution = cdn.distribution;

    // Create a DNS record pointing to your CloudFront distribution
    if (props.domainName && hostedZone) {
      new route53.ARecord(this, 'SiteAliasRecord', {
        recordName: siteSubdomain,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cdn.distribution)),
        zone: hostedZone,
      });
    }
    // Lambda
    // Common Config
    const lambda_architecture = awsLambda.Architecture.ARM_64;
    const lambda_runtime = awsLambda.Runtime.PYTHON_3_12;
    var lambda_bundling_image = DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest');
    if (os.arch() === 'arm64') {
      lambda_bundling_image = DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest-arm64');
    }

    // Layers
    const lambdaLayers = this.lambdaLayers(stack, lambda_architecture, lambda_runtime, lambda_bundling_image);

    this.lambdaConfig = {
      architecture: lambda_architecture,
      runtime: lambda_runtime,
      bundlingImage: lambda_bundling_image,
    };

    // Event Bus
    this.eventbridge = new Eventbridge(this, 'eventbridge');
    this.eventbridge.eventbus.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AllowPutEvents-' + props.labelName,
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.AccountRootPrincipal()],
        actions: ['events:PutEvents'],
        resources: [this.eventbridge.eventbus.eventBusArn],
      })
    );

    // Cognito Resources
    this.idp = new Idp(this, 'idp', {
      distribution: cdn.distribution,
      defaultAdminEmail: props.email,
      lambdaConfig: {
        ...this.lambdaConfig,
        layersConfig: { ...lambdaLayers },
      },
      eventbus: this.eventbridge.eventbus,
    });

    // protect cognito with WAF
    new wafv2.CfnWebACLAssociation(this, 'cognitoWafAssociation', {
      webAclArn: wafWebAclRegional.attrArn,
      resourceArn: `arn:${this.partition}:cognito-idp:${this.region}:${this.account}:userpool/${this.idp.userPool.userPoolId}`,
    });

    // SSM parameters for cross-stack sharing (avoids CloudFormation Fn::ImportValue dependencies)
    new ssm.StringParameter(this, 'ssmCloudfrontDistributionId', {
      parameterName: `/${this.stackName}/cloudfrontDistributionId`,
      stringValue: cdn.distribution.distributionId,
    });
    new ssm.StringParameter(this, 'ssmCloudfrontDistributionDomainName', {
      parameterName: `/${this.stackName}/cloudfrontDistributionDomainName`,
      stringValue: cdn.distribution.distributionDomainName,
    });
    new ssm.StringParameter(this, 'ssmCloudfrontDomainName', {
      parameterName: `/${this.stackName}/cloudfrontDomainName`,
      stringValue: siteDomain ? siteDomain[0] : cdn.distribution.distributionDomainName,
    });
    new ssm.StringParameter(this, 'ssmLogsBucketName', {
      parameterName: `/${this.stackName}/logsBucketName`,
      stringValue: logsBucket.bucketName,
    });
    new ssm.StringParameter(this, 'ssmWebsiteBucketName', {
      parameterName: `/${this.stackName}/websiteBucketName`,
      stringValue: dremWebsite.sourceBucket.bucketName,
    });
    new ssm.StringParameter(this, 'ssmEventBusArn', {
      parameterName: `/${this.stackName}/eventBusArn`,
      stringValue: this.eventbridge.eventbus.eventBusArn,
    });
    new ssm.StringParameter(this, 'ssmUserPoolId', {
      parameterName: `/${this.stackName}/userPoolId`,
      stringValue: this.idp.userPool.userPoolId,
    });
    new ssm.StringParameter(this, 'ssmIdentityPoolId', {
      parameterName: `/${this.stackName}/identityPoolId`,
      stringValue: this.idp.identityPool.ref,
    });
    new ssm.StringParameter(this, 'ssmUserPoolClientWebId', {
      parameterName: `/${this.stackName}/userPoolClientWebId`,
      stringValue: this.idp.userPoolClientWeb.userPoolClientId,
    });
    new ssm.StringParameter(this, 'ssmAdminGroupRoleArn', {
      parameterName: `/${this.stackName}/adminGroupRoleArn`,
      stringValue: this.idp.adminGroupRole.roleArn,
    });
    new ssm.StringParameter(this, 'ssmOperatorGroupRoleArn', {
      parameterName: `/${this.stackName}/operatorGroupRoleArn`,
      stringValue: this.idp.operatorGroupRole.roleArn,
    });
    new ssm.StringParameter(this, 'ssmCommentatorGroupRoleArn', {
      parameterName: `/${this.stackName}/commentatorGroupRoleArn`,
      stringValue: this.idp.commentatorGroupRole.roleArn,
    });
    new ssm.StringParameter(this, 'ssmRegistrationGroupRoleArn', {
      parameterName: `/${this.stackName}/registrationGroupRoleArn`,
      stringValue: this.idp.registrationGroupRole.roleArn,
    });
    new ssm.StringParameter(this, 'ssmAuthenticatedUserRoleArn', {
      parameterName: `/${this.stackName}/authenticatedUserRoleArn`,
      stringValue: this.idp.authenticatedUserRole.roleArn,
    });
  }

  lambdaLayers = (
    stack: cdk.Stack,
    lambda_architecture: awsLambda.Architecture,
    lambda_runtime: awsLambda.Runtime,
    lambda_bundling_image: DockerImage
  ) => {
    // helper functions layer
    const helperFunctionsLambdaLayer = new lambdaPython.PythonLayerVersion(this, 'helperFunctionsLambdaLayer', {
      entry: 'lib/lambda_layers/helper_functions/',
      compatibleArchitectures: [lambda_architecture],
      compatibleRuntimes: [lambda_runtime],
      bundling: { image: lambda_bundling_image },
    });

    new ssm.StringParameter(this, 'helperFunctionsLayerArn', {
      stringValue: helperFunctionsLambdaLayer.layerVersionArn,
      parameterName: `/${this.stackName}/helperFunctionsLambdaLayerArn`,
    });

    // Powertools layer
    const powertoolsLambdaLayer = lambdaPython.PythonLayerVersion.fromLayerVersionArn(
      this,
      'lambdaPowertoolsLambdaLayer',
      `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:11`
    );

    new ssm.StringParameter(this, 'powertoolsLayerArn', {
      stringValue: powertoolsLambdaLayer.layerVersionArn,
      parameterName: `/${this.stackName}/powertoolsLambdaLayerArn`,
    });

    // Appsync helpers layer
    const appsyncHelpersLambdaLayer = new lambdaPython.PythonLayerVersion(this, 'appsyncHelpersLambdaLayer', {
      entry: 'lib/lambda_layers/appsync_helpers/',
      compatibleArchitectures: [lambda_architecture],
      compatibleRuntimes: [lambda_runtime],
      bundling: { image: lambda_bundling_image },
    });

    new ssm.StringParameter(this, 'appsyncHelperLambdaLayerArn', {
      stringValue: appsyncHelpersLambdaLayer.layerVersionArn,
      parameterName: `/${this.stackName}/appsyncHelpersLambdaLayerArn`,
    });

    return {
      helperFunctionsLayer: helperFunctionsLambdaLayer,
      powerToolsLayer: powertoolsLambdaLayer,
      appsyncHelpersLayer: appsyncHelpersLambdaLayer,
      powerToolsLogLevel: 'INFO',
    };
  };

  webApplicationFirewall = (rateLimit: number) => {
    const wafWebAclRegional = new wafv2.CfnWebACL(this, 'wafWebAclRegional', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `DREM-WAF-WebACL-Regional-${this.stackName}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'RateBasedRule',
          priority: 0,
          action: {
            count: {}, // TODO set to block: {} after testing at summit/big customer event which use a proxy
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `RateBasedRule-${this.stackName}`,
          },
          statement: {
            rateBasedStatement: {
              limit: rateLimit,
              aggregateKeyType: 'IP',
            },
          },
        },
      ],
    });

    // SSM Parameter used to share the WAF web ACL ARN with the app stack
    new ssm.StringParameter(this, 'wafWebAclRegionalSSM', {
      stringValue: wafWebAclRegional.attrArn,
      parameterName: `/${this.stackName}/regionalWafWebAclArn`,
    });

    return wafWebAclRegional;
  };
}
