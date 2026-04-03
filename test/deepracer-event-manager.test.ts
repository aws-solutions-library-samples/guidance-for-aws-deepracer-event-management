import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CdkPipelineStack } from '../lib/cdk-pipeline-stack';
import { BaseStack } from '../lib/base-stack';

// Setting 'aws:cdk:bundling-stacks' to [] tells CDK not to invoke Docker for
// asset bundling. Lambda code assets get placeholder hashes instead of real
// bundles, but the CloudFormation template structure (resources, properties,
// SSM parameters) is identical to a real synth.
const makeApp = () =>
  new cdk.App({
    context: {
      'aws:cdk:bundling-stacks': [],
    },
  });

const ENV = { account: '123456789012', region: 'eu-west-1' };

test('Pipeline stack synthesizes with a CodePipeline resource', () => {
  const app = new cdk.App();
  const stack = new CdkPipelineStack(app, 'TestPipelineStack', {
    labelName: 'test',
    sourceRepo: 'aws-solutions-library-samples/guidance-for-aws-deepracer-event-management',
    sourceBranchName: 'main',
    email: 'test@example.com',
    env: { account: '123456789012', region: 'eu-west-2' },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});

describe('BaseStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = makeApp();
    const stack = new BaseStack(app, 'TestBase', {
      email: 'test@example.com',
      labelName: 'test',
      env: ENV,
    });
    template = Template.fromStack(stack);
  });

  test('creates all required SSM parameters for cross-stack sharing', () => {
    const expectedKeys = [
      'cloudfrontDistributionId',
      'cloudfrontDistributionDomainName',
      'cloudfrontDomainName',
      'logsBucketName',
      'websiteBucketName',
      'eventBusArn',
      'userPoolId',
      'identityPoolId',
      'userPoolClientWebId',
      'adminGroupRoleArn',
      'operatorGroupRoleArn',
      'commentatorGroupRoleArn',
      'registrationGroupRoleArn',
      'authenticatedUserRoleArn',
    ];

    for (const key of expectedKeys) {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: Match.stringLikeRegexp(`/TestBase/${key}$`),
      });
    }
  });
});
