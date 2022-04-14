## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer Event Manager (DREM).
## ----------------------------------------------------------------------------

help:			## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

all: frontend.deploy	## Deploy the application

frontend.deploy: frontend.config
	cdk deploy CdkDeepRacerEventManagerFEDeployStack --require-approval never

frontend.only.deploy:
	cdk deploy CdkDeepRacerEventManagerFEDeployStack --require-approval never

frontend.config: infra.deploy
	python generate_amplify_config.py
	python update_index_html_with_script_tag.py

infra.deploy:
	echo "{}" > website/src/config.json
	cdk deploy CdkDeepRacerEventManagerStack --require-approval never --outputs-file cdk.outputs

clean:			## Tear down the stack, only do this if you're really sure
	cdk destroy

local.install:		## Install Python and Javascript dependencies
	pip install -r requirements.txt
	npm install --prefix website

local.run:		## Run the frontend application locally for development
	npm start --prefix website

local.config:
	python generate_amplify_config.py

.NOTPARALLEL:
