## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer Event Manager (DREM).
## ----------------------------------------------------------------------------

help:			## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

pipeline.deploy: 	## Deploy the CDK pipeline, currently hardcoded to arn:aws:s3:::drem-pipeline-zip-113122841518-eu-west-1
	cdk diff

pipeline.clean: 	## Destroys the CDK pipeline
	cdk destroy

manual.deploy: frontend.deploy		## Deploy the application directly from command line (note this will not be compatible with a pipeline deploy)

frontend.deploy: frontend.config
	branch=`cat branch.txt` && cdk deploy drem-frontend-$$branch --require-approval never --context manual_deploy=True 

frontend.only.deploy:
	branch=`cat branch.txt` && cdk deploy drem-frontend-$$branch --require-approval never --context manual_deploy=True 

frontend.config: infra.deploy
	branch=`cat branch.txt` && aws cloudformation describe-stacks --stack-name drem-backend-$$branch-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python generate_amplify_config_cfn.py
	python update_index_html_with_script_tag_cfn.py

infra.deploy:
	echo "{}" > website/src/config.json
	branch=`cat branch.txt` && cdk deploy drem-backend-$$branch-infrastructure --require-approval never --context manual_deploy=True 

manual.clean:		## Tear down the stack, only do this if you're really sure
	cdk destroy  --context manual_deploy=True 

local.install:		## Install Python and Javascript dependencies + Generate Config from deployed backend
	pip install -r requirements.txt
	npm install -g aws-cdk
	echo "{}" > website/src/config.json
	branch=`cat branch.txt` && aws cloudformation describe-stacks --stack-name drem-backend-$$branch-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python generate_amplify_config_cfn.py
	python update_index_html_with_script_tag_cfn.py

local.run:		## Run the frontend application locally for development
	npm start --prefix website

local.clean:		## Renmove everything
	pip freeze | grep -v "^-e" | xargs pip uninstall -y
	pip uninstall deepracer_event_manager -y
	rm -rf node_modules

.NOTPARALLEL:
