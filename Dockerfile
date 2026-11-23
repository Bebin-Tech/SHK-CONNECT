FROM ghcr.io/cirruslabs/flutter:3.41.9 AS client-build
WORKDIR /build/client
COPY client/pubspec.* ./
RUN flutter pub get
COPY client/ ./
RUN flutter build web --release --no-web-resources-cdn

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home app
COPY backend/ ./backend/
COPY alembic.ini .
COPY --from=client-build /build/client/build/web ./client/build/web
RUN mkdir -p /data/uploads && chown -R app:app /data /app
USER app
EXPOSE 5000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2", "--no-proxy-headers"]
