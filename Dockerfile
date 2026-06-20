# Single-stage image: install, build, and run the Next.js app (UI + /api/run).
FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching. (Includes devDeps,
# which are needed for `next build`.)
COPY package*.json ./
RUN npm ci

# Build the app.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Tesseract language data and Gemini calls require outbound network at runtime.
CMD ["npm", "run", "start"]
