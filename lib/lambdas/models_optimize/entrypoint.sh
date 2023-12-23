#!/usr/bin/bash
VARS="$@"
source /opt/intel/openvino/bin/setupvars.sh
if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
  exec /usr/local/bin/aws-lambda-rie /usr/bin/python3 $VARS
else
  exec /usr/bin/python3 $VARS
fi
