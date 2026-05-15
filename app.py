import os
try:
    import eventlet
    eventlet.monkey_patch()
except ImportError:
    pass

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import inspect, text
from models import db, User, Role, Group, Message
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
        import eventlet
        return 'eventlet'
    except ImportError:
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
migrate = Migrate(app, db)
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
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(chat_bp, url_prefix='/chat')

# Register Socket Handlers
register_socket_handlers(socketio)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def seed_roles():
    roles = ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']
    for role_name in roles:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name))
    db.session.commit()

def ensure_schema_columns():
    """Add small backward-compatible columns for existing SQLite/Postgres installs."""
    inspector = inspect(db.engine)
    if 'groups' in inspector.get_table_names():
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
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=True)
            return redirect(url_for('chat.index'))
        flash('Invalid email or password', 'danger')
    return render_template('login.html', title='Login')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('chat.index'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            flash('Email already exists', 'danger')
            return redirect(url_for('signup'))
            
        member_role = Role.query.filter_by(name='Member').first()
        new_user = User(
            username=username,
            email=email,
            role_id=member_role.id if member_role else None
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('chat.index'))
    return render_template('signup.html', title='Sign Up')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = env_bool('FLASK_DEBUG', False)
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
