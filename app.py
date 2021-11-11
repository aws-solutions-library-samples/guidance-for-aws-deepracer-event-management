#!/usr/bin/env python3
import os

from aws_cdk import core as cdk

# For consistency with TypeScript code, `cdk` is the preferred import name for
# the CDK's core module.  The following line also imports it as `core` for use
# with examples from the CDK Developer's Guide, which are in the process of
# being updated to use `cdk`.  You may delete this import if you don't need it.
from aws_cdk import core

from deepracer_event_manager.deepracer_event_manager_stack import CdkDeepRacerEventManagerStack
from deepracer_event_manager.deepracer_event_manager_fe_deploy_stack import CdkDeepRacerEventManagerFEDeployStack

# Region
env=core.Environment(
    account=os.environ["CDK_DEFAULT_ACCOUNT"],
    region="eu-west-1"
)

app = core.App()
infrastructure = CdkDeepRacerEventManagerStack(app, "CdkDeepRacerEventManagerStack", env=env)
CdkDeepRacerEventManagerFEDeployStack(app, "CdkDeepRacerEventManagerFEDeployStack", env=env, source_bucket=infrastructure.source_bucket, distribution=infrastructure.distribution)

app.synth()
