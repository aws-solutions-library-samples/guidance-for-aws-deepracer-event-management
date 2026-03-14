# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
# from https://github.com/awslabs/cdk-serverless-clamscan/blob/main/assets/lambda/code/download_defs/Dockerfile

FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12
LABEL name=lambda/python/clamav
LABEL version=1.0

ARG CACHE_DATE=1
RUN dnf update -y \
    && dnf -y install clamav1.4 clamd1.4 \
    && dnf clean all \
    && pip3 install --no-cache-dir cffi awslambdaric boto3 requests aws-lambda-powertools \
    && ln -s /etc/freshclam.conf /tmp/freshclam.conf

COPY index.py /var/task/index.py

ENTRYPOINT [ "/var/lang/bin/python3", "-m", "awslambdaric" ]
CMD [ "index.handler" ]