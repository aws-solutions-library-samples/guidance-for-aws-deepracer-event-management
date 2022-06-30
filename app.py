#!/usr/bin/env python3
import os

# For consistency with TypeScript code, `cdk` is the preferred import name for
# the CDK's core module.  The following line also imports it as `core` for use
# with examples from the CDK Developer's Guide, which are in the process of
# being updated to use `cdk`.  You may delete this import if you don't need it.
from aws_cdk import Environment, App

# from deepracer_event_manager.deepracer_event_manager_stack import CdkDeepRacerEventManagerStack
# from deepracer_event_manager.deepracer_event_manager_fe_deploy_stack import CdkDeepRacerEventManagerFEDeployStack
from backend.deepracer_event_manager_pipeline_stack import CdkServerlessCharityPipelineStack

# Region
env=Environment(
    account=os.environ["CDK_DEFAULT_ACCOUNT"],
    region="eu-west-1"
)

with open('branch.txt') as branch_file:
    branchname = branch_file.read().splitlines()[0]
    print("Branch Name: " + branchname)

app = App()
# infrastructure = CdkDeepRacerEventManagerStack(app, "CdkDeepRacerEventManagerStack", env=env)
# CdkDeepRacerEventManagerFEDeployStack(app, "CdkDeepRacerEventManagerFEDeployStack", env=env, source_bucket=infrastructure.source_bucket, distribution=infrastructure.distribution)
CdkServerlessCharityPipelineStack(app, "drem-pipeline-" + branchname, branchname=branchname, env=env)

app.synth()
