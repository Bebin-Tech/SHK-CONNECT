FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY alembic.ini .
COPY --chmod=755 deploy/entrypoint.sh /usr/local/bin/shk-entrypoint
RUN mkdir -p /data/uploads && chown -R app:app /app /data
EXPOSE 5000
ENTRYPOINT ["/usr/local/bin/shk-entrypoint"]
CMD ["sh", "-c", "python -m alembic upgrade head && exec uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-5000} --workers 2 --no-proxy-headers"]
