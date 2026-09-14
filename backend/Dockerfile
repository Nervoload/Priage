FROM node:20-alpine AS build
WORKDIR /app
ARG DATABASE_URL=postgresql://build:build@localhost:5432/priage?schema=public
ENV DATABASE_URL=$DATABASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run prisma:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts ./scripts
EXPOSE 3000
CMD ["node", "dist/main.js"]
