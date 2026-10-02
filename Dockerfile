FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node app ./app
COPY --chown=node:node index.html style.css script.js recuerdos.js girasol.js musica.mp3 ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production PORT=4180 DATA_DIR=/app/data
EXPOSE 4180
VOLUME ["/app/data"]
CMD ["node", "app/server.mjs"]
