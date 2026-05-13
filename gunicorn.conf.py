import os

bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"
worker_class = "eventlet"
workers = int(os.getenv("WEB_CONCURRENCY", "1"))
threads = 1
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "50"))

if workers < 1:
    workers = 1

# Flask-SocketIO rooms are process-local without a message queue, so one worker is
# the stable default for Render free hosting.
if worker_class == "eventlet":
    workers = 1
