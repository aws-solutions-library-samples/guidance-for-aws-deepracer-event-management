FROM alpine:latest
# Install packages
RUN apk update && apk add --update --no-cache \
    aws-cli \
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

# # Install AWSCLI
# RUN pip install --upgrade awscli

# Update NPM
RUN npm update -g
RUN npm fund

# Install cdk
RUN npm install -g aws-cdk
RUN cdk --version

#Install Amplify
RUN npm install -g @aws-amplify/cli

# NPM install
WORKDIR /deepracer-event-manager
COPY package*.json .
COPY website/package*.json ./website/
COPY website-leaderboard/package*.json ./website-leaderboard/
COPY website-stream-overlays/package*.json ./website-stream-overlays/
RUN npm install
RUN npm install --prefix website
RUN npm install --prefix website-leaderboard
RUN npm install --prefix website-stream-overlays

COPY . .
