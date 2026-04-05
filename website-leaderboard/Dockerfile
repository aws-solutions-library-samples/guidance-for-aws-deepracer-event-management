FROM public.ecr.aws/docker/library/node:22-alpine

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

# Update NPM
RUN npm update -g

# Install cdk
RUN npm install -g aws-cdk

#Install Amplify
RUN npm install -g @aws-amplify/cli

# NPM install
WORKDIR /app
COPY package*.json /app/

RUN npm install

ENV PORT=3000

CMD ["npx", "vite", "--host"]
