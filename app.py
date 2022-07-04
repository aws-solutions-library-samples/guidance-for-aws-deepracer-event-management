#!/usr/bin/env python3
import os
import sys

# For consistency with TypeScript code, `cdk` is the preferred import name for
# the CDK's core module.  The following line also imports it as `core` for use
# with examples from the CDK Developer's Guide, which are in the process of
# being updated to use `cdk`.  You may delete this import if you don't need it.
from aws_cdk import Environment, App

from backend.deepracer_event_manager_stack import CdkDeepRacerEventManagerStack
from backend.deepracer_event_manager_fe_deploy_stack import CdkDeepRacerEventManagerFEDeployStack
from backend.deepracer_event_manager_pipeline_stack import CdkServerlessCharityPipelineStack

# Region
env=Environment(
    account=os.environ["CDK_DEFAULT_ACCOUNT"],
    region="eu-west-1"
)

branch_file_name = 'branch.txt'
if os.path.exists(branch_file_name):
    with open('branch.txt') as branch_file:
        branchname = branch_file.read().splitlines()[0]
        print("Branch Name: " + branchname)
else:
    sys.exit('{} does not exist, please create and populate with the branch name you are working on.'.format(branch_file_name)) 

app = App()
manual_deploy = False
if app.node.try_get_context("manual_deploy") == 'True':
    manual_deploy = True

if manual_deploy:
    print('Manual deploy')
    infrastructure = CdkDeepRacerEventManagerStack(app, "drem-backend-" + branchname + "-infrastructure", env=env)
    CdkDeepRacerEventManagerFEDeployStack(app, "drem-frontend-" + branchname, env=env, source_bucket=infrastructure.source_bucket, distribution=infrastructure.distribution)
else:
    print('Pipeline deploy')
    CdkServerlessCharityPipelineStack(app, "drem-pipeline-" + branchname, branchname=branchname, env=env)

app.synth()
