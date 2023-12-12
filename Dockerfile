FROM docker:dind
# Install packages
RUN apk update && apk add --update --no-cache \
    git \
    bash \
    curl \
    openssh \
    python3 \
    py3-pip \
    py-cryptography \
    wget \
    curl \
    nodejs \
    npm \
    zip
RUN apk --no-cache add --virtual builds-deps build-base python3
# Install AWSCLI
RUN pip install --upgrade pip && \
    pip install --upgrade awscli
# Update NPM
RUN npm update -g
RUN npm fund
# Install cdk
RUN npm install -g aws-cdk
RUN cdk --version

#Install Amplify
RUN npm install -g @aws-amplify/cli

EXPOSE 3000
EXPOSE 3001
EXPOSE 3002

WORKDIR /deepracer-event-manager
