FROM node:21-alpine
# Install packages
RUN apk update && apk add --update --no-cache \
    aws-cli \
    bash \
    curl \
    git \
    openssh \
    py-cryptography \
    py3-pip \
    python3 \
    wget \
    zip
RUN apk --no-cache add --virtual builds-deps build-base python3

# Update NPM
RUN npm update -g

# Install cdk
RUN npm install -g aws-cdk

#Install Amplify
RUN npm install -g @aws-amplify/cli

# Install dependencies
WORKDIR /app

COPY ./package*.json /app/
COPY ./website/package*.json /app/website/
COPY ./website-leaderboard/package*.json /app/website-leaderboard/
COPY ./website-stream-overlays/package*.json /app/website-stream-overlays/

RUN npm install

EXPOSE 3000-3002
