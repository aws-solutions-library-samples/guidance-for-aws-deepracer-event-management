## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer Event Manager (DREM).
## ----------------------------------------------------------------------------

help:			## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

pipeline.deploy: 	## Deploy the CDK pipeline, eu-west-1
	npx cdk deploy

pipeline.clean: 	## Destroys the CDK pipeline
	npx cdk destroy

pipeline.trigger: 	## creates the zipfile and uploads it to S3 to trigger the pipeline
	zip -r drem.zip . -x ./.venv/\* ./.git/\* ./website/build/\* ./website/node_modules/\* ./node_modules/\* ./cdk.out/\*
	aws s3 cp drem.zip s3://$$(cat s3_bucket.txt)/$$(cat branch.txt)/

local.install:		## Install Python and Javascript dependencies + Generate Config from deployed backend
	npm install
	npm install --prefix website

local.config:		## Setup local config based on branch
	echo "{}" > website/src/config.json
	branch=`cat branch.txt` && aws cloudformation describe-stacks --stack-name drem-backend-$$branch-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python scripts/generate_amplify_config_cfn.py
	python scripts/update_index_html_with_script_tag_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --api-id $$appsyncId --format SDL ./website/src/graphql/schema.graphql
	cd website/src/graphql/ && amplify codegen

local.run:		## Run the frontend application locally for development
	npm start --prefix website

.PHONY: local.clean
local.clean:		## Remove local packages and modules
	pip freeze | grep -v "^-e" | xargs pip uninstall -y
	rm -rf website/node_modules

.NOTPARALLEL:
