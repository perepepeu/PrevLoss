FROM node:24.12.0-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY docs/openapi.json /build/docs/openapi.json
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi==0.135.1 numpy==2.4.2 pydantic==2.12.5 python-dotenv==1.2.1 uvicorn==0.41.0
COPY backend/ ./backend/
COPY --from=frontend /build/frontend/dist ./frontend/dist/
ENV PREVLOSS_STATIC_DIR=/app/frontend/dist \
    PREVLOSS_STATE_FILE=/var/data/session.json \
    PREVLOSS_REQUIRE_AUTH=1
EXPOSE 10000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
