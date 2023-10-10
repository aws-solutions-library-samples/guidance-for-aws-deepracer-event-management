# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
# from https://github.com/awslabs/cdk-serverless-clamscan/blob/main/assets/lambda/code/download_defs/Dockerfile

FROM public.ecr.aws/lambda/python:3.9
LABEL name=lambda/python/clamav
LABEL version=1.0

ARG CACHE_DATE=1
RUN yum update -y \
    && yum install -y amazon-linux-extras \
    && PYTHON=python2 amazon-linux-extras install epel \
    && yum -y install clamav clamd \
    && yum clean all \
    && pip3 install --no-cache-dir cffi awslambdaric boto3 requests aws-lambda-powertools \
    && ln -s /etc/freshclam.conf /tmp/freshclam.conf

COPY index.py /var/task/index.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]