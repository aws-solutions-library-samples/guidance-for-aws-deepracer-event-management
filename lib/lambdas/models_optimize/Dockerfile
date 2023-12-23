# Derived from Dockerfile provided by Intel on https://github.com/openvinotoolkit/docker_ci/tree/master/dockerfiles
# SPDX-License-Identifier: Apache-2.0
FROM public.ecr.aws/ubuntu/ubuntu:20.04

ENV TZ="America/New_York" 
ENV DEBIAN_FRONTEND="noninteractive" 
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    python3-pip \
    libjsoncpp-dev \
    sudo \
    curl \
    gnupg

ARG build_id=2021.1.110
# Install full package
RUN curl -o /tmp/GPG-PUB-KEY-INTEL-SW-PRODUCTS https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB && \
    apt-key add /tmp/GPG-PUB-KEY-INTEL-SW-PRODUCTS && \
    echo "deb https://apt.repos.intel.com/openvino/2021 all main" | tee /etc/apt/sources.list.d/intel-openvino-2021.list && \
    apt-get update && apt-get install -y --no-install-recommends intel-openvino-dev-ubuntu20-"${build_id}"
ADD requirements_tf.txt /opt/intel/openvino_"${build_id}"/deployment_tools/model_optimizer/
RUN /opt/intel/openvino_"${build_id}"/deployment_tools/model_optimizer/install_prerequisites/install_prerequisites.sh tf && \
    ln --symbolic /opt/intel/openvino_"${build_id}"/ /opt/intel/openvino

RUN pip3 install -U aws_lambda_powertools jmespath awslambdaric requests_aws4auth boto3
RUN curl -Lo /usr/local/bin/aws-lambda-rie https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie && chmod +x /usr/local/bin/aws-lambda-rie

ADD *.py /
ADD entrypoint.sh /

ENTRYPOINT ["./entrypoint.sh", "-m", "awslambdaric"]
CMD ["model_optimizer_lambda.lambda_handler"]