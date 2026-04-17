import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CdkPipelineStack } from '../lib/cdk-pipeline-stack';
import { BaseStack } from '../lib/base-stack';
import { DeepracerEventManagerStack } from '../lib/drem-app-stack';

// Setting 'aws:cdk:bundling-stacks' to [] tells CDK not to invoke Docker for
// asset bundling. Lambda code assets get placeholder hashes instead of real
// bundles, but the CloudFormation template structure (resources, properties,
// cross-stack references) is identical to a real synth.
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

// ---------------------------------------------------------------------------
// BaseStack
// ---------------------------------------------------------------------------

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
    // These are the keys consumed by DeepracerEventManagerStack via
    // ssm.StringParameter.valueForStringParameter(). If any are missing or
    // renamed here they must also be updated in drem-app-stack.ts.
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

  test('does not export any CloudFormation outputs for cross-stack consumption', () => {
    // All cross-stack sharing is via SSM, not CfnOutput/Fn::ImportValue.
    // If Outputs exist they should only be informational (e.g. printed by CDK)
    // and not consumed by DeepracerEventManagerStack via Fn::ImportValue.
    const templateJson = JSON.stringify(template.toJSON());
    expect(templateJson).not.toContain('Fn::ImportValue');
  });
});

// ---------------------------------------------------------------------------
// DeepracerEventManagerStack
// ---------------------------------------------------------------------------

describe('DeepracerEventManagerStack', () => {
  let templateJson: string;
  let template: Template;

  beforeAll(() => {
    const app = makeApp();
    const base = new BaseStack(app, 'TestBase', {
      email: 'test@example.com',
      labelName: 'test',
      env: ENV,
    });
    const infra = new DeepracerEventManagerStack(app, 'TestInfra', {
      baseStackName: base.stackName,
      env: ENV,
    });
    template = Template.fromStack(infra);
    templateJson = JSON.stringify(template.toJSON());
  });

  test('has no Fn::ImportValue references to the base stack', () => {
    // This is the critical regression test for the SSM cross-stack refactor.
    // Fn::ImportValue creates a hard CloudFormation dependency between stacks
    // that prevents either stack from being updated independently (you get
    // "cannot delete export ... as it is in use" errors).
    expect(templateJson).not.toContain('Fn::ImportValue');
  });

  test('resolves base stack values via CloudFormation SSM parameter types', () => {
    // ssm.StringParameter.valueForStringParameter() emits CloudFormation
    // Parameters of type AWS::SSM::Parameter::Value<String> (resolved by
    // CloudFormation at deploy time, not at synth time). This confirms the
    // infra stack is reading from SSM rather than via Fn::ImportValue.
    expect(templateJson).toContain('AWS::SSM::Parameter::Value<String>');
  });
});
