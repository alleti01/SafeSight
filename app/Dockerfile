# The website, for Railway (railway.json at the repo root points here).
# Build context is the repo root. Railway passes NEXT_PUBLIC_BRAIN_URL in as a build
# argument when it's set on the service; without it the site shows the example results.
FROM node:22-slim AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
ARG NEXT_PUBLIC_BRAIN_URL
ENV NEXT_PUBLIC_BRAIN_URL=$NEXT_PUBLIC_BRAIN_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
# next start listens on $PORT, which Railway sets.
CMD ["npm", "start"]
