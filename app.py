import sys

import os

# Patch only when eventlet was explicitly selected, before importing Flask.
if os.getenv('SOCKETIO_ASYNC_MODE') == 'eventlet' and sys.version_info < (3, 13):
    import eventlet
    eventlet.monkey_patch()

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_migrate import Migrate
from sqlalchemy import func
from models import db, User, Role
from admin_routes import admin_bp
from chat_routes import chat_bp
from api_routes import api_bp
from workspace_routes import workspace_bp
from socket_handlers import register_socket_handlers
from dotenv import load_dotenv
from extensions import socketio

load_dotenv()

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

def normalize_database_url(url):
    if not url:
        logger.warning("!!! WARNING: DATABASE_URL not found. Using local SQLite. Data will NOT persist on cloud restarts! !!!")
        return 'sqlite:///shk_connect.db'

    # Clean the URL (remove trailing dots, spaces, etc.)
    url = url.strip()

    if url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql://', 1)
    return url

db_url = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_DATABASE_URI'] = normalize_database_url(db_url)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

if db_url:
    logger.info("Using external database (PostgreSQL/MySQL)")
else:
    logger.warning("!!! WARNING: DATABASE_URL not found. Using local SQLite. ALL DATA WILL BE LOST ON RESTART ON RENDER/HEROKU !!!")

def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}

def get_async_mode():
    return os.getenv('SOCKETIO_ASYNC_MODE', 'threading') if sys.version_info < (3, 13) else 'threading'

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or __import__('secrets').token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = env_bool('SESSION_COOKIE_SECURE')
app.config['MAX_CONTENT_LENGTH'] = 21 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', os.path.join(app.instance_path, 'uploads'))
app.config['PREFERRED_URL_SCHEME'] = os.getenv('PREFERRED_URL_SCHEME', 'https')

db.init_app(app)
migrate = Migrate(app, db)

# Initialize SocketIO with calculated async mode
async_mode = get_async_mode()
# Python 3.13+ check: force threading if eventlet is likely to fail
if sys.version_info.major == 3 and sys.version_info.minor >= 13:
    async_mode = 'threading'

socketio.init_app(
    app,
    cors_allowed_origins=os.getenv('SOCKETIO_CORS_ORIGINS') or None,
    async_mode=async_mode,
    max_http_buffer_size=21 * 1024 * 1024,
    ping_timeout=60,
    ping_interval=25,
)

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Register Blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(workspace_bp, url_prefix='/api')

# Register Socket Handlers
register_socket_handlers(socketio)

@app.after_request
def audit_mutations(response):
    if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and response.status_code < 400 and current_user.is_authenticated and request.endpoint != 'workspace.mark_read':
        from models import ActivityLog
        db.session.add(ActivityLog(action=f'{request.method} {request.endpoint}',
                                   details=request.path, user_id=current_user.id,
                                   ip_address=request.remote_addr))
        db.session.commit()
    return response

@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/') or request.path.startswith('/chat/') and request.endpoint != 'chat.index' or request.path.startswith('/admin/') and request.accept_mimetypes.best == 'application/json':
        return jsonify({'error': 'Authentication required'}), 401
    return redirect(url_for('login'))

@login_manager.user_loader
def load_user(user_id):
    try:
        user = db.session.get(User, int(user_id))
        return user if user and user.is_active else None
    except (TypeError, ValueError):
        return None

def initialize_database():
    if not env_bool('AUTO_CREATE_DB', True):
        return
    with app.app_context():
        db.create_all()
        for name in ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']:
            if not Role.query.filter_by(name=name).first():
                db.session.add(Role(name=name))
        db.session.commit()
        # Bootstrap is opt-in and never changes an existing account.
        email = os.getenv('ADMIN_EMAIL', 'admin@shk.com')
        password = os.getenv('ADMIN_PASSWORD')
        if password and not User.query.filter((User.email == email) | (User.username == email)).first():
            user = User(username=email, email=email, role=Role.query.filter_by(name='Admin').one())
            user.set_password(password)
            db.session.add(user)
            db.session.commit()

@app.context_processor
def frontend_assets():
    import json
    from pathlib import Path
    manifest = Path(app.static_folder) / 'dist' / '.vite' / 'manifest.json'
    entry = json.loads(manifest.read_text()).get('src/main.jsx', {}) if manifest.exists() else {}
    return {'frontend_entry': entry}

@app.route('/dm/<int:group_id>')
@app.route('/users')
@app.route('/history')
@app.route('/history/<int:group_id>')
@app.route('/tickets')
@app.route('/expenses')
@app.route('/logs')
@app.route('/profile')
@login_required
def frontend_page(group_id=None):
    return render_template('react_chat.html')


initialize_database()

@app.route('/')
def home():
    if current_user.is_authenticated:
        return redirect(url_for('chat.index'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('chat.index'))
    if request.method == 'POST':
        identifier = (request.form.get('email') or '').strip()
        password = request.form.get('password') or ''
        remember = True if request.form.get('remember') else False

        # Case-insensitive check by Email OR Username
        user = User.query.filter(
            (func.lower(User.email) == func.lower(identifier)) |
            (func.lower(User.username) == func.lower(identifier))
        ).first()

        if user and user.is_active and user.check_password(password):
            login_user(user, remember=remember)
            return redirect(url_for('chat.index'))

        logger.warning(f"Failed login attempt for: {identifier}")
        flash('Invalid User ID or password', 'danger')
    return render_template('login.html', title='Login')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('chat.index'))
    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        email = (request.form.get('email') or '').strip()
        password = request.form.get('password') or ''
        if not username or len(username) > 100 or '@' not in email or len(email) > 120 or not password:
            flash('All fields are required', 'danger')
            return redirect(url_for('signup'))
        if User.query.filter((func.lower(User.email).in_([email.lower(), username.lower()])) | (func.lower(User.username).in_([email.lower(), username.lower()]))).first():
            flash('Email already exists', 'danger')
            return redirect(url_for('signup'))
        member_role = Role.query.filter_by(name='Member').first()
        new_user = User(username=username, email=email, role_id=member_role.id if member_role else None)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('chat.index'))
    return render_template('signup.html', title='Sign Up')

@app.route('/logout')
@login_required
def logout():
    from socket_handlers import disconnect_user
    disconnect_user(socketio, current_user.id)
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=env_bool('FLASK_DEBUG', False), allow_unsafe_werkzeug=True)
