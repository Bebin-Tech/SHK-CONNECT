import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Workspace, Channel, Message, Role
from admin_routes import admin_bp
from chat_routes import chat_bp
from socket_handlers import register_socket_handlers
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'shk-secret-key-123')
# Use MySQL if configured, otherwise fallback to SQLite for easy local setup
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///shk_work_flow.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
login_manager = LoginManager(app)

login_manager.login_view = 'login'

# Register Blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(chat_bp, url_prefix='/chat')

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

# Routes
@app.route('/')
@login_required
def index():
    return redirect(url_for('chat.index'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid email or password', 'danger')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        if user:
            flash('Email already exists', 'danger')
            return redirect(url_for('signup'))
            
        # Get default Member role
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
        return redirect(url_for('index'))
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Create tables if they don't exist
        seed_roles()    # Seed Admin, Owner, Member roles
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)


