import os
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_socketio import SocketIO
from flask_login import LoginManager, login_user, logout_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import inspect, text
from models import db, User, Role
from admin_routes import admin_bp
from chat_routes import chat_bp
from socket_handlers import register_socket_handlers
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)


def normalize_database_url(database_url):
    """Render/Postgres may expose postgres://, while SQLAlchemy expects postgresql://."""
    if database_url and database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql://', 1)
    return database_url


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def socketio_async_mode():
    requested = os.getenv('SOCKETIO_ASYNC_MODE')
    if requested:
        return requested
    try:
        import eventlet.green.threading  # noqa: F401
        return 'eventlet'
    except Exception:
        return 'threading'


app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-this-secret-key-in-render')
app.config['SQLALCHEMY_DATABASE_URI'] = normalize_database_url(
    os.getenv('DATABASE_URL', 'sqlite:///shk_connect.db')
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 20 * 1024 * 1024))
app.config['UPLOAD_FOLDER'] = os.getenv(
    'UPLOAD_FOLDER',
    os.path.join(app.root_path, 'static', 'uploads')
)
app.config['PREFERRED_URL_SCHEME'] = os.getenv('PREFERRED_URL_SCHEME', 'https')
app.config['SESSION_COOKIE_SECURE'] = env_bool('SESSION_COOKIE_SECURE', False)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')

db.init_app(app)
socketio = SocketIO(
    app,
    cors_allowed_origins=os.getenv('SOCKETIO_CORS_ORIGINS', '*'),
    async_mode=socketio_async_mode(),
    ping_timeout=int(os.getenv('SOCKETIO_PING_TIMEOUT', 60)),
    ping_interval=int(os.getenv('SOCKETIO_PING_INTERVAL', 25)),
)
login_manager = LoginManager(app)

login_manager.login_view = 'login'

# Register Blueprints
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(chat_bp, url_prefix='/api/chat')

# Register Socket Handlers
register_socket_handlers(socketio)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def seed_roles():
    roles = ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']
    for role_name in roles:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name))
    db.session.commit()


def ensure_schema_columns():
    """Add small backward-compatible columns for existing SQLite/Postgres installs."""
    inspector = inspect(db.engine)
    group_columns = {col['name'] for col in inspector.get_columns('groups')}
    if 'avatar_url' not in group_columns:
        db.session.execute(text('ALTER TABLE groups ADD COLUMN avatar_url VARCHAR(255)'))
        db.session.commit()


def initialize_database():
    if not env_bool('AUTO_CREATE_DB', True):
        return
    with app.app_context():
        db.create_all()
        ensure_schema_columns()
        seed_roles()


initialize_database()

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify

# Routes
@app.route('/api/auth/me')
def auth_me():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Not authenticated'}), 401
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'email': current_user.email,
        'role': current_user.role.name if current_user.role else 'Member'
    })

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        login_user(user, remember=data.get('remember', False))
        return jsonify({
            'success': True, 
            'user': {
                'id': user.id, 
                'username': user.username, 
                'role': user.role.name if user.role else 'Member'
            }
        })
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/auth/signup', methods=['POST'])
def api_signup():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if user:
        return jsonify({'error': 'Email already exists'}), 400
        
    member_role = Role.query.filter_by(name='Member').first()
    new_user = User(
        username=username, 
        email=email, 
        password_hash=generate_password_hash(password),
        role_id=member_role.id if member_role else None
    )
    db.session.add(new_user)
    db.session.commit()
    login_user(new_user)
    return jsonify({
        'success': True,
        'user': {
            'id': new_user.id,
            'username': new_user.username,
            'role': new_user.role.name if new_user.role else 'Member'
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'success': True})

from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # Don't serve API, static, or socket.io requests through the React catch-all
    if path.startswith('api/') or path.startswith('static/') or path.startswith('socket.io/'):
        return "Not found", 404
        
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    
    # If the file exists, serve it
    if path != "" and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    
    # Otherwise, return index.html for client-side routing
    return send_from_directory(dist_dir, 'index.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = env_bool('FLASK_DEBUG', False)
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)
