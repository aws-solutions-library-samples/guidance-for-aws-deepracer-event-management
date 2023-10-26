## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer Event Manager (DREM).
## ----------------------------------------------------------------------------

## CONFIG
include build.config

ifndef branch
override branch = main
endif

## CONSTANTS
dremSrcPath := website/src
leaderboardSrcPath := website-leaderboard/src
overlaysSrcPath := website-stream-overlays/src
dremBucket := $$(aws ssm get-parameter --name '/drem/S3RepoBucket' --output text --query 'Parameter.Value' | cut -d ':' -f 6)

## ----------------------------------------------------------------------------
.PHONY: help
help:			## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

.PHONY: install
install: pipeline.trigger pipeline.deploy ## uploads the artifact and build the deploy pipeline

.PHONY: bootstrap
bootstrap: ## bootstraps the CDK environment
	cdk bootstrap -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(region)

.PHONY: clean
clean: pipeline.clean s3.clean

## Dev related tragets

pipeline.deploy: 	## Deploy the CDK pipeline, eu-west-1
	npx cdk deploy -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(region)

pipeline.clean: 	## Destroys the CDK pipeline
	npx cdk destroy -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(region)

drem.clean-infrastructure:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(branch)-infrastructure

drem.clean-base:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(branch)-base

pipeline.trigger: 	## creates the zipfile and uploads it to S3 to trigger the pipeline
	@echo "Packaging build artifact"
	-rm drem.zip
	zip -r drem.zip . -x ./.venv/\* ./.git/\* ./website/build/\* ./website/node_modules/\* ./node_modules/\* ./cdk.out/\* ./website-leaderboard/build/\* ./website-leaderboard/node_modules/\* ./website-stream-overlays/build/\* ./website-stream-overlays/node_modules/\*
	@echo "upload artifact to S3 bucket"
	aws s3 cp drem.zip s3://$(dremBucket)/$(branch)/

manual.deploy:  ## deploy via cdk
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(region) --all

manual.deploy.hotswap: ## deploy via cdk --hotswap
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(region) --all --hotswap

local.install:		## Install Python and Javascript dependencies + Generate Config from deployed backend
	npm install
	npm install --prefix website
	npm install --prefix website-leaderboard
	npm install --prefix website-stream-overlays

local.config:		## Setup local config based on branch
	echo "{}" > ${dremSrcPath}/config.json
	aws cloudformation describe-stacks --stack-name drem-backend-$(branch)-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python3 scripts/generate_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --api-id $$appsyncId --format SDL ./$(dremSrcPath)/graphql/schema.graphql
	pushd $(dremSrcPath)/graphql/ && amplify codegen; popd

	echo "{}" > $(leaderboardSrcPath)/config.json
	python3 scripts/generate_leaderboard_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --api-id $$appsyncId --format SDL $(leaderboardSrcPath)/graphql/schema.graphql
	pushd $(leaderboardSrcPath)/graphql/ && amplify codegen; popd

	echo "{}" > $(overlaysSrcPath)/config.json
	python3 scripts/generate_stream_overlays_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --api-id $$appsyncId --format SDL $(overlaysSrcPath)/graphql/schema.graphql
	pushd $(overlaysSrcPath)/graphql/ && amplify codegen; popd

local.run:		## Run the frontend application locally for development
	PORT=3000 npm start --prefix website

local.run-leaderboard:		## Run the frontend application locally for development
	PORT=3001 npm start --prefix website-leaderboard

local.run-overlays:		## Run the frontend application locally for development
	PORT=3002 npm start --prefix website-stream-overlays

local.clean:		## Remove local packages and modules
	-rm package-lock.json
	rm -rf node_modules
	-rm website/package-lock.json
	rm -rf website/node_modules
	-rm website-leaderboard/package-lock.json
	rm -rf website-leaderboard/node_modules
	-rm website-stream-overlays/package-lock.json
	rm -rf website-stream-overlays/node_modules

leaderboard.zip:
	-rm website/public/leaderboard-timer.zip
	zip -r website/public/leaderboard-timer.zip leaderboard-timer -x "*.git*" -x "*node_modules*" -x "*stl*" -x "*.DS_Store"

.NOTPARALLEL:
