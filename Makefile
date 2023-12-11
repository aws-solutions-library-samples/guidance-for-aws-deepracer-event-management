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
dremBucket := $$(aws ssm get-parameter --name '/drem/S3RepoBucket' --output text --query 'Parameter.Value' --region $(region) | cut -d ':' -f 6)

## ----------------------------------------------------------------------------
.PHONY: help
help:						## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

.PHONY: install
install: pipeline.trigger pipeline.deploy	## Uploads the artifact and build the deploy pipeline

.PHONY: bootstrap
bootstrap: 					## Bootstraps the CDK environment
	cdk bootstrap -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION)

.PHONY: clean
clean: pipeline.clean s3.clean

## Dev related tragets

pipeline.synth: 				## Synth the CDK pipeline
	npx cdk synth -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION)

pipeline.deploy: 				## Deploy the CDK pipeline
	npx cdk deploy -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION)

pipeline.clean: 				## Destroys the CDK pipeline
	npx cdk destroy -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION)

drem.clean-infrastructure:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(branch)-infrastructure --region $(REGION)

drem.clean-base:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(branch)-base --region $(REGION)

pipeline.trigger: 				## Creates the zipfile and uploads it to S3 to trigger the pipeline
	@echo "Packaging build artifact"
	-rm drem.zip
	zip -r drem.zip . -x ./.venv/\* ./.git/\* ./website/build/\* ./website/node_modules/\* ./node_modules/\* ./cdk.out/\* ./website-leaderboard/build/\* ./website-leaderboard/node_modules/\* ./website-stream-overlays/build/\* ./website-stream-overlays/node_modules/\*
	@echo "upload artifact to S3 bucket"
	aws s3 cp drem.zip s3://$(dremBucket)/$(branch)/

manual.deploy:  				## Deploy via cdk
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION) --all

manual.deploy.hotswap: 				## Deploy via cdk --hotswap
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c branch=$(branch) -c account=$(account_id) -c region=$(REGION) --all --hotswap

local.install:					## Install Python and Javascript dependencies + Generate Config from deployed backend
	npm install
	npm install --prefix website
	npm install --prefix website-leaderboard
	npm install --prefix website-stream-overlays

local.config:					## Setup local config based on branch
	echo "{}" > ${dremSrcPath}/config.json
	aws cloudformation describe-stacks --region $(REGION) --stack-name drem-backend-$(branch)-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python3 scripts/generate_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(REGION) --api-id $$appsyncId --format SDL ./$(dremSrcPath)/graphql/schema.graphql
	current_dir=$(pwd)
	cd $(dremSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(leaderboardSrcPath)/config.json
	python3 scripts/generate_leaderboard_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(REGION) --api-id $$appsyncId --format SDL $(leaderboardSrcPath)/graphql/schema.graphql
	cd $(leaderboardSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(overlaysSrcPath)/config.json
	python3 scripts/generate_stream_overlays_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(REGION) --api-id $$appsyncId --format SDL $(overlaysSrcPath)/graphql/schema.graphql
	cd $(overlaysSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

local.run:					## Run the frontend application locally for development
	PORT=3000 npm start --prefix website

local.run-leaderboard:				## Run the frontend leaderboard application locally for development
	PORT=3001 npm start --prefix website-leaderboard

local.run-overlays:				## Run the frontend overlays application locally for development
	PORT=3002 npm start --prefix website-stream-overlays

local.docker.run: local.docker.clean		## Run DREM in docker for development
	docker build --tag=deepracer-build-env:latest .
	docker run --privileged -p 3000-3002:3000-3002 -d --mount type=bind,source=$(shell pwd),target=/deepracer-event-manager --name deepracer-build deepracer-build-env:latest
	docker exec -it deepracer-build /bin/bash

local.docker.start:				## Run DREM in docker once built
	docker start deepracer-build

local.docker.stop:				## Stop DREM docker instance
	docker stop deepracer-build

local.docker.clean:				## Remove deepracer-build docker container
	-docker rm deepracer-build

local.clean:					## Remove local packages and modules
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
