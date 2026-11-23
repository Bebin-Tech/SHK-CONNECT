"""Archive retired application source before removing it from the active workspace."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
targets = ['app.py', 'models.py', 'admin_routes.py', 'api_routes.py', 'chat_routes.py', 'workspace_routes.py',
           'socket_handlers.py', 'messaging.py', 'extensions.py', 'create_admin.py', 'gunicorn.conf.py',
           'frontend', 'templates', 'static', 'tests', 'SHK-CONNECT', 'SHK-CONNECT-1', 'REVIEW.md',
           '.github/workflows/python-package.yml']
destination = root / '.test-artifacts' / 'legacy-source-before-flutter.zip'
destination.parent.mkdir(exist_ok=True)
if destination.exists():
    raise SystemExit('Legacy backup already exists. Do not overwrite it.')
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in targets:
        path = root / name
        files = path.rglob('*') if path.is_dir() else [path]
        for file in files:
            if file.is_file() and not any(p in {'node_modules', '.git', '.venv', '__pycache__'} for p in file.relative_to(root).parts):
                archive.write(file, file.relative_to(root))
print(f'Archived retired source to {destination}')
