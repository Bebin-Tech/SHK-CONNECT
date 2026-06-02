import eventlet
eventlet.monkey_patch()

# Patch psycopg2 for eventlet if it's installed
try:
    from psycogreen.eventlet import patch_psycopg
    patch_psycopg()
except ImportError:
    pass

import os
import sys

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_migrate import Migrate
from sqlalchemy import inspect, text
from models import db, User, Role, Group, Message, Expense, ActivityLog, SupportTicket
from admin_routes import admin_bp
from chat_routes import chat_bp
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
        if os.getenv('FLASK_ENV') == 'production':
            raise RuntimeError("CRITICAL ERROR: DATABASE_URL not set in production environment!")
        return 'sqlite:///shk_connect.db'

    # Clean the URL (remove trailing dots, spaces, etc.)
    url = url.strip().rstrip('.')

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
    if sys.version_info.major == 3 and sys.version_info.minor >= 13:
        return 'threading'
    mode = os.getenv('SOCKETIO_ASYNC_MODE')
    if mode: return mode
    try:
        import eventlet
        return 'eventlet'
    except ImportError:
        return 'threading'

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'shk-industries-default-secret')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', os.path.join(app.root_path, 'static', 'uploads'))
app.config['PREFERRED_URL_SCHEME'] = os.getenv('PREFERRED_URL_SCHEME', 'https')

db.init_app(app)
migrate = Migrate(app, db)

# Initialize SocketIO with calculated async mode
socketio.init_app(
    app,
    cors_allowed_origins=os.getenv('SOCKETIO_CORS_ORIGINS', '*'),
    async_mode=get_async_mode(),
    ping_timeout=60,
    ping_interval=25,
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

def initialize_database():
    if not env_bool('AUTO_CREATE_DB', True): return
    try:
        with app.app_context():
            # Check if we already have roles. If so, we assume DB is initialized.
            if inspect(db.engine).has_table("roles"):
                if Role.query.first():
                    print("Database already initialized. Skipping seed.")
                    return

            db.create_all()
            # Seed basic roles
            roles = ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']
            for r in roles:
                if not Role.query.filter_by(name=r).first():
                    db.session.add(Role(name=r))
            db.session.commit()
            print("Database initialized and roles seeded successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")
        # Don't re-raise here if you want the app to still try to start,
        # but for Render it's often better to fail fast so you see it in logs.
        raise e

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
        identifier = request.form.get('email') # This matches the 'name' attribute in your login template
        password = request.form.get('password')

        # Check by Email OR Username
        user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()

        if user and user.check_password(password):
            login_user(user, remember=True)
            return redirect(url_for('chat.index'))
        flash('Invalid User ID or password', 'danger')
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
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=env_bool('FLASK_DEBUG', False), allow_unsafe_werkzeug=True)
