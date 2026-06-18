import sys

# Eventlet monkey patching (skip if running Python 3.13 or newer)
if sys.version_info.major == 3 and sys.version_info.minor < 13:
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
from api_routes import api_bp
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
async_mode = get_async_mode()
# Python 3.13+ check: force threading if eventlet is likely to fail
if sys.version_info.major == 3 and sys.version_info.minor >= 13:
    async_mode = 'threading'

socketio.init_app(
    app,
    cors_allowed_origins=os.getenv('SOCKETIO_CORS_ORIGINS', '*'),
    async_mode=async_mode,
    ping_timeout=60,
    ping_interval=25,
)

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Register Blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(chat_bp, url_prefix='/chat')
app.register_blueprint(api_bp, url_prefix='/api')

# Register Socket Handlers
register_socket_handlers(socketio)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def initialize_database():
    if not env_bool('AUTO_CREATE_DB', True): return
    try:
        with app.app_context():
            # Ensure the database schema is up-to-date
            # Attempt to alter avatar_url and file_url to TEXT for Base64 support
            try:
                db.session.execute(text("ALTER TABLE groups ALTER COLUMN avatar_url TYPE TEXT"))
                db.session.execute(text("ALTER TABLE messages ALTER COLUMN file_url TYPE TEXT"))
                db.session.commit()
                print("Database schema updated: Large data columns optimized.")
            except Exception:
                db.session.rollback()

            # Check if we already have roles. If so, we assume DB is initialized.
            inspector = inspect(db.engine)
            if not inspector.has_table("roles"):
                db.create_all()
                print("Database tables created.")

            # Seed basic roles
            roles = ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']
            for r_name in roles:
                if not Role.query.filter_by(name=r_name).first():
                    db.session.add(Role(name=r_name))
            db.session.commit()

            # Ensure a default Admin user exists
            admin_role = Role.query.filter_by(name='Admin').first()
            admin_email = 'admin@shk.com'
            admin_username = 'admin@shk.com'

            existing_admin = User.query.filter((User.email == admin_email) | (User.username == admin_username)).first()

            if not existing_admin:
                admin_user = User(
                    username=admin_username,
                    email=admin_email,
                    role_id=admin_role.id if admin_role else None
                )
                admin_user.set_password("admin123")
                db.session.add(admin_user)
                db.session.commit()
                print(f"Default Admin user created: {admin_email} / admin123")
            else:
                # If the admin exists but you can't log in, let's force reset the password to admin123
                # This ensures the credentials you provided ALWAYS work on startup.
                existing_admin.set_password("admin123")
                existing_admin.email = admin_email
                existing_admin.username = admin_username
                if admin_role:
                    existing_admin.role_id = admin_role.id
                db.session.commit()
                print(f"Admin account reset/verified: {admin_email} / admin123")

            print("Database check/initialization complete.")
    except Exception as e:
        print(f"Error during database initialization: {e}")
        db.session.rollback()
        # In production, if we can't init the DB, we might want to know.
        if os.getenv('FLASK_ENV') == 'production':
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
        identifier = (request.form.get('email') or '').strip()
        password = (request.form.get('password') or '').strip()
        remember = True if request.form.get('remember') else False

        # Case-insensitive check by Email OR Username
        from sqlalchemy import func
        user = User.query.filter(
            (func.lower(User.email) == func.lower(identifier)) |
            (func.lower(User.username) == func.lower(identifier))
        ).first()

        if user and user.check_password(password):
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
