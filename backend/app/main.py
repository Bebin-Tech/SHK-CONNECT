from contextlib import asynccontextmanager
import asyncio
from contextlib import suppress
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from .api import auth, business, workspace, notifications
from .push_worker import run_worker
from .core.config import get_settings
from .db import engine


def create_app():
    cfg = get_settings()

    @asynccontextmanager
    async def lifespan(app):
        cfg.upload_dir.mkdir(parents=True, exist_ok=True)
        worker = asyncio.create_task(run_worker())
        try:
            yield
        finally:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker

    app = FastAPI(title='SHK Connect API', version='2.0.0', lifespan=lifespan,
                  docs_url='/api/docs' if cfg.environment != 'production' else None,
                  redoc_url=None, openapi_url='/api/openapi.json' if cfg.environment != 'production' else None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=cfg.allowed_hosts)
    app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_credentials=True,
                       allow_methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
                       allow_headers=['Authorization', 'Content-Type'])

    @app.middleware('http')
    async def headers(request: Request, call_next):
        length = request.headers.get('content-length', '0')
        if not length.isdigit():
            return JSONResponse({'detail': 'Invalid content length'}, status_code=400)
        if request.url.path.startswith('/api/') and int(length) > cfg.max_upload_bytes + 1024 * 1024:
            return JSONResponse({'detail': 'Request too large'}, status_code=413)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['X-Frame-Options'] = 'DENY'
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        if cfg.environment == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    @app.exception_handler(IntegrityError)
    async def conflict(request, error):
        return JSONResponse({'detail': 'Conflicting update. Refresh and try again.'}, status_code=409)

    for router in (auth.router, workspace.router, business.router, notifications.router):
        app.include_router(router, prefix='/api/v1')

    @app.get('/api/health', tags=['Operations'])
    def health():
        try:
            with engine.connect() as connection:
                connection.execute(text('SELECT 1'))
            return {'status': 'ok', 'version': '2.0.0'}
        except Exception:
            return JSONResponse({'status': 'unavailable'}, status_code=503)

    @app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], include_in_schema=False)
    def missing_api(path: str):
        return JSONResponse({'detail': 'API endpoint not found'}, status_code=404)

    if cfg.web_dir.is_dir():
        app.mount('/', StaticFiles(directory=cfg.web_dir, html=True), name='flutter')
    return app


app = create_app()
