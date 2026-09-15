# ratel-web — serves the React static build (apps/web/dist) plus the small
# Node server (apps/web/server/serve.mjs) that does link-preview meta
# injection for space/post URLs (see
# docs/superpower/2026-09-14-react-frontend-migration.md § 5.1/5.2) and
# answers /healthz for k8s probes.
#
# This image contains NO build step — `dist/` and `server/` are built
# upstream (pnpm -C apps/web build; see apps/web/.dockerignore for what is
# excluded from the build context) and copied in as-is.
FROM node:22-alpine

WORKDIR /app

COPY dist ./dist
COPY server ./server

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

RUN chown -R node:node /app
USER node

CMD ["node", "server/serve.mjs"]
