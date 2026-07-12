# Use the official Node.js image as the base image
FROM node:22

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the application port
EXPOSE 4002

# Command to run the application
# CMD ["node", "dist/src/main"]

# Start in dev mode (no build needed)
CMD ["npm", "run", "start:dev"]

