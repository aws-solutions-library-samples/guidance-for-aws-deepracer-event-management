FROM public.ecr.aws/docker/library/node:20-alpine

# Install packages
RUN apk update && apk add --update --no-cache \
    aws-cli \
    bash \
    curl \
    git \
    openssh \
    py-cryptography \
    py3-pip \
    wget \
    zip
RUN apk --no-cache add --virtual builds-deps build-base python3

# Install cdk
RUN npm install -g aws-cdk

# Install Amplify CLI (used by `make codegen` for GraphQL code generation)
RUN npm install -g @aws-amplify/cli

# NPM install
WORKDIR /app
COPY package*.json /app/

RUN npm install --legacy-peer-deps

ENV PORT=3000

# Vite needs --host to be accessible outside the container
CMD ["npx", "vite", "--host"]