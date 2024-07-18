# Use the official Node.js image as the base image for building the application.
FROM node:21-alpine3.18 as builder

# Enable Corepack and prepare for PNPM installation
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and pnpm-lock.yaml files to the working directory
COPY package*.json pnpm-lock.yaml ./

# Install git for potential dependencies
RUN apk add --no-cache git

# Install PM2 globally using PNPM
RUN pnpm install pm2 -g

# Copy the application source code into the container
COPY . .

# Install dependencies using PNPM
RUN pnpm install

# Create a new stage for deployment
FROM builder as deploy

# Copy only necessary files and directories for deployment
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Install production dependencies using frozen lock file
RUN pnpm install --frozen-lockfile --production

EXPOSE 3030
EXPOSE 5555
# Define the command to start the application using PM2 runtime
