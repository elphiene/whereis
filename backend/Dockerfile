FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production 2>/dev/null || bun install --production

COPY . .

EXPOSE 3000
CMD ["bun", "index.ts"]
