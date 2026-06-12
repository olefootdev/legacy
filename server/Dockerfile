# Dockerfile do olefoot-server (Railway, Root Directory = server/).
#
# Por que Dockerfile e não Nixpacks: o motor da Partida Rápida 2.0 chama
# server/smartfield/match_simulator.py via spawn('python3'). Com Nixpacks/Railpack
# o python3 não entrava no PATH (spawn python3 ENOENT). Aqui instalamos python3
# via apt — determinístico, sempre no PATH.

FROM node:20-slim

# Python 3 (stdlib basta — o motor não usa pacotes externos)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Deps primeiro (cache de camada). Inclui devDeps — o build usa tsc.
COPY package*.json ./
RUN npm ci --include=dev

# Código + build (tsc → dist/). Copia também server/smartfield/*.py.
COPY . .
RUN npm run build

ENV NODE_ENV=production
CMD ["npm", "start"]
