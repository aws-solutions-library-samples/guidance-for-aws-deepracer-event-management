## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer Event Manager (DREM).
## ----------------------------------------------------------------------------

## CONFIG
include build.config

ifndef label
override label = main
endif

ifndef source_repo
override source_repo = aws-solutions-library-samples/guidance-for-aws-deepracer-event-management
endif

ifndef source_branch
override source_branch = release/stable
endif

ifdef domain_name
domain_name_arg = -c domain_name=$(domain_name)
else
domain_name_arg =
endif

## CONSTANTS
dremSrcPath := website/src
leaderboardSrcPath := website-leaderboard/src
overlaysSrcPath := website-stream-overlays/src

## ----------------------------------------------------------------------------
.PHONY: help
help:						## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

.PHONY: install
install: pipeline.deploy	## Uploads the artifact and build the deploy pipeline

.PHONY: bootstrap
bootstrap: 					## Bootstraps the CDK environment
	cdk bootstrap -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo)

.PHONY: clean
clean: pipeline.clean s3.clean

## Dev related targets

pipeline.synth: 				## Synth the CDK pipeline
	npx cdk synth -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo) $(domain_name_arg)

pipeline.deploy: 				## Deploy the CDK pipeline
	npx cdk deploy -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo) $(domain_name_arg)

pipeline.clean: 				## Destroys the CDK pipeline
	npx cdk destroy -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo)

drem.clean-infrastructure:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-infrastructure --region $(region)

drem.clean-base:			## Delete DREM application
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-base --region $(region)

manual.deploy:  				## Deploy via cdk
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo) $(domain_name_arg) --all

manual.deploy.hotswap: 			## Deploy via cdk --hotswap
	npx cdk deploy --c manual_deploy=True -c email=$(email) -c label=$(label) -c account=$(account_id) -c region=$(region) -c source_branch=$(source_branch) -c source_repo=$(source_repo) $(domain_name_arg) --all --hotswap

manual.deploy.website: local.config
	cd website && npm run build
	aws s3 sync website/build/ s3://$$(jq -r '.[] | select(.OutputKey=="sourceBucketName") | .OutputValue' cfn.outputs)/ --delete
	aws cloudfront create-invalidation --distribution-id $$(jq -r '.[] | select(.OutputKey=="distributionId") | .OutputValue' cfn.outputs) --paths "/*"

local.install:					## Install Javascript dependencies
	npm install

local.config:					## Setup local config based on branch
	echo "{}" > ${dremSrcPath}/config.json
	aws cloudformation describe-stacks --region $(region) --stack-name drem-backend-$(label)-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python3 scripts/generate_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL ./$(dremSrcPath)/graphql/schema.graphql
	current_dir=$(pwd)
	cd $(dremSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(leaderboardSrcPath)/config.json
	python3 scripts/generate_leaderboard_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(leaderboardSrcPath)/graphql/schema.graphql
	cd $(leaderboardSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(overlaysSrcPath)/config.json
	python3 scripts/generate_stream_overlays_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(overlaysSrcPath)/graphql/schema.graphql
	cd $(overlaysSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

local.config.docker:					## Setup local config based on branch
	echo "{}" > ${dremSrcPath}/config.json
	aws cloudformation describe-stacks --region $(region) --stack-name drem-backend-$(label)-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	python3 scripts/generate_amplify_config_cfn.py --docker
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL ./$(dremSrcPath)/graphql/schema.graphql
	current_dir=$(pwd)
	cd $(dremSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(leaderboardSrcPath)/config.json
	python3 scripts/generate_leaderboard_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(leaderboardSrcPath)/graphql/schema.graphql
	cd $(leaderboardSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(overlaysSrcPath)/config.json
	python3 scripts/generate_stream_overlays_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(overlaysSrcPath)/graphql/schema.graphql
	cd $(overlaysSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

local.config.python:		## Setup a Python .venv
	python3 -m venv --prompt drem .venv
	source .venv/bin/activate
	pip install -e .[dev]
	
local.run:					## Run the frontend application locally for development
	PORT=3000 npm start --prefix website

local.clean:					## Remove local packages and modules
	-rm package-lock.json
	rm -rf node_modules
	-rm website/package-lock.json
	rm -rf website/node_modules
	-rm website-leaderboard/package-lock.json
	rm -rf website-leaderboard/node_modules
	-rm website-stream-overlays/package-lock.json
	rm -rf website-stream-overlays/node_modules

local.run-leaderboard:				## Run the frontend leaderboard application locally for development
	PORT=3001 npm start --prefix website-leaderboard

local.run-overlays:				## Run the frontend overlays application locally for development
	PORT=3002 npm start --prefix website-stream-overlays

local.docker.build:				## Build DREM docker services
	docker compose build --no-cache website leaderboard overlays

local.docker.up: 				## Run DREM using docker for development
	docker compose up -d

local.docker.logs:				## View the DREM docker logs
	docker compose logs -f

local.docker.down:				## Stop DREM docker instance
	docker compose down

local.docker.clean:				## Remove DREM docker container and volumes (destructive)
	docker compose rm website -f -v
	docker compose rm leaderboard -f -v
	docker compose rm overlays -f -v

leaderboard.zip:
	-rm website/public/leaderboard-timer.zip
	zip -r website/public/leaderboard-timer.zip leaderboard-timer -x "*.git*" -x "*node_modules*" -x "*stl*" -x "*.DS_Store"

.NOTPARALLEL:
