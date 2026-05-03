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
leaderboardSrcPath := website/leaderboard/src
overlaysSrcPath := website/overlays/src
VENV_PYTHON := .venv/bin/python3

# Shared CDK context flags. Centralised so the long flag list isn't duplicated
# across every `cdk` invocation. `domain_name_arg` is empty when `domain_name`
# isn't set in build.config — passing an empty string is a no-op for cdk.
CDK_CONTEXT := -c email=$(email) -c label=$(label) -c account=$(account_id) \
               -c region=$(region) -c source_branch=$(source_branch) \
               -c source_repo=$(source_repo) $(domain_name_arg)

## ----------------------------------------------------------------------------
.PHONY: help
help:						## Show this help
	@awk 'BEGIN { \
	    FS = ":.*?## "; \
	    printf "\n\033[1mDREM — common Makefile targets\033[0m\n\nUsage: \033[1mmake\033[0m \033[36m<target>\033[0m\n"; \
	  } \
	  /^##@ / { sub(/^##@ /, ""); printf "\n\033[1m%s\033[0m\n", $$0; next } \
	  /^[a-zA-Z_.][a-zA-Z0-9_.-]*:.*## / { \
	    match($$0, /## /); desc = substr($$0, RSTART + 3); \
	    match($$0, /^[a-zA-Z_.][a-zA-Z0-9_.-]*/); target = substr($$0, 1, RLENGTH); \
	    printf "  \033[36m%-28s\033[0m %s\n", target, desc; \
	  }' $(MAKEFILE_LIST)
	@printf "\n"

##@ Install / bootstrap

.PHONY: install
install: pipeline.deploy	## Deploy the CDK pipeline (alias for drem.install)

.PHONY: drem.install
drem.install: pipeline.deploy	## Deploy the CDK pipeline

.PHONY: bootstrap drem.bootstrap
bootstrap: drem.bootstrap		## Bootstrap the CDK environment (alias for drem.bootstrap)
drem.bootstrap: 				## Bootstrap the CDK environment
	cdk bootstrap $(CDK_CONTEXT)

##@ Pipeline (CDK self-mutating)

.PHONY: pipeline.synth pipeline.deploy pipeline.clean
pipeline.synth: 				## Synth the CDK pipeline
	npx cdk synth $(CDK_CONTEXT)

pipeline.deploy: 				## Deploy the CDK pipeline
	npx cdk deploy $(CDK_CONTEXT) --require-approval never

pipeline.clean: 				## Destroys the CDK pipeline stack only
	npx cdk destroy $(CDK_CONTEXT) --force

##@ Cleanup / teardown

.PHONY: clean
clean: drem.clean			## Teardown all DREM AWS resources (alias for drem.clean)

.PHONY: drem.clean drem.clean-infrastructure drem.clean-base
drem.clean:					## Teardown all DREM AWS resources (pipeline then app stacks, waits for each)
	@echo "--- Destroying pipeline stack ---"
	npx cdk destroy $(CDK_CONTEXT) --force
	@echo "--- Deleting infrastructure stack ---"
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-infrastructure --region $(region)
	aws cloudformation wait stack-delete-complete --stack-name drem-backend-$(label)-infrastructure --region $(region)
	@echo "--- Deleting base stack ---"
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-base --region $(region)
	aws cloudformation wait stack-delete-complete --stack-name drem-backend-$(label)-base --region $(region)
	@echo "--- DREM teardown complete ---"

drem.clean-infrastructure:			## Delete infrastructure stack only (async, no wait)
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-infrastructure --region $(region)

drem.clean-base:				## Delete base stack only (async, no wait)
	aws cloudformation delete-stack --stack-name drem-backend-$(label)-base --region $(region)


##@ Manual deploy (bypass the pipeline, deploy direct from local)

.PHONY: manual.deploy manual.deploy.specific manual.deploy.hotswap manual.deploy.website
manual.deploy:  				## Deploy via cdk
	npx cdk deploy --c manual_deploy=True $(CDK_CONTEXT) --all

manual.deploy.specific:         ## Deploy a specific stack (usage: make manual.deploy.specific stack=YourStackName)
	npx cdk deploy --c manual_deploy=True $(CDK_CONTEXT) -e $(stack)

manual.deploy.hotswap: 			## Deploy via cdk --hotswap
	npx cdk deploy --c manual_deploy=True $(CDK_CONTEXT) --all --hotswap

manual.deploy.website: local.config local.build	## Build all three apps and deploy to S3
	cd website && npm run build
	aws s3 sync website/build/ s3://$$(jq -r '.[] | select(.OutputKey=="sourceBucketName") | .OutputValue' cfn.outputs)/ --delete
	aws cloudfront create-invalidation --distribution-id $$(jq -r '.[] | select(.OutputKey=="distributionId") | .OutputValue' cfn.outputs) --paths "/*"

##@ Local development

.PHONY: local.install local.config
local.install:					## Install Javascript dependencies
	npm install

local.config: | .venv/.installed				## Setup local config based on branch
	echo "{}" > ${dremSrcPath}/config.json
	aws cloudformation describe-stacks --region $(region) --stack-name drem-backend-$(label)-infrastructure --query 'Stacks[0].Outputs' > cfn.outputs
	$(VENV_PYTHON) scripts/generate_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL ./$(dremSrcPath)/graphql/schema.graphql
	current_dir=$(pwd)
	cd $(dremSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(leaderboardSrcPath)/config.json
	$(VENV_PYTHON) scripts/generate_leaderboard_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(leaderboardSrcPath)/graphql/schema.graphql
	cd $(leaderboardSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)

	echo "{}" > $(overlaysSrcPath)/config.json
	$(VENV_PYTHON) scripts/generate_stream_overlays_amplify_config_cfn.py
	appsyncId=`cat appsyncId.txt` && aws appsync get-introspection-schema --region $(region) --api-id $$appsyncId --format SDL $(overlaysSrcPath)/graphql/schema.graphql
	cd $(overlaysSrcPath)/graphql/ && amplify codegen
	cd $(current_dir)


##@ Tests

.PHONY: test test.cdk test.website test.leaderboard
test: test.cdk test.website test.leaderboard	## Run all tests

test.cdk:					## Run CDK tests
	npm test

test.website:					## Run website tests
	cd website && npm test

test.leaderboard:				## Run leaderboard tests
	cd website/leaderboard && npm test


##@ Python venv (for Lambda dev / local config)

.venv/.installed: pyproject.toml		# (internal) create venv when pyproject.toml changes
	python3 -m venv --prompt drem .venv
	.venv/bin/pip install --quiet -e .[dev]
	@touch .venv/.installed

.PHONY: venv
venv: .venv/.installed				## Create Python virtual environment

.PHONY: local.config.python
local.config.python: venv			## Setup a Python .venv

##@ Local frontend builds

.PHONY: local.build local.build.leaderboard local.build.overlays local.run local.clean
local.build.leaderboard:			## Build leaderboard into website/public/leaderboard
	cd website/leaderboard && npm install --legacy-peer-deps && npm run build
	rm -rf website/public/leaderboard
	cp -r website/leaderboard/build website/public/leaderboard

local.build.overlays:				## Build overlays into website/public/overlays
	cd website/overlays && npm install --legacy-peer-deps && npm run build
	rm -rf website/public/overlays
	cp -r website/overlays/build website/public/overlays

local.build: local.build.leaderboard local.build.overlays	## Build leaderboard + overlays into website/public/ for unified local dev

local.run:					## Run the frontend application locally for development (run local.build first)
	PORT=3000 npm start --prefix website

local.clean:					## Remove local packages and modules
	-rm package-lock.json
	rm -rf node_modules
	-rm website/package-lock.json
	rm -rf website/node_modules
	-rm website/leaderboard/package-lock.json
	rm -rf website/leaderboard/node_modules
	-rm website/overlays/package-lock.json
	rm -rf website/overlays/node_modules


##@ Local Docker

.PHONY: local.docker.build local.docker.up local.docker.logs local.docker.down local.docker.clean
local.docker.build: local.build		## Build DREM docker service (runs local.build first)
	docker compose build --no-cache website

local.docker.up: 				## Run DREM using docker for development
	docker compose up -d

local.docker.logs:				## View the DREM docker logs
	docker compose logs -f

local.docker.down:				## Stop DREM docker instance
	docker compose down

local.docker.clean:				## Remove DREM docker container and volumes (destructive)
	docker compose rm website -f -v

##@ Misc

.PHONY: leaderboard.zip
leaderboard.zip:				## Bundle leaderboard-timer/ into website/public/leaderboard-timer.zip
	-rm website/public/leaderboard-timer.zip
	zip -r website/public/leaderboard-timer.zip leaderboard-timer -x "*.git*" -x "*node_modules*" -x "*stl*" -x "*.DS_Store"

.NOTPARALLEL:
