FROM public.ecr.aws/docker/library/node:20-alpine

# Install minimal system packages
RUN apk update && apk add --update --no-cache \
    aws-cli \
    bash \
    curl \
    git \
    openssh \
    wget \
    zip

# NPM install
WORKDIR /app
COPY package*.json /app/

RUN npm install

ENV PORT=3000

CMD ["npm", "start"]