from app import app
from models import db, User, Role
from werkzeug.security import generate_password_hash

def create_admin():
    with app.app_context():
        # Initialize database tables
        db.create_all()
        
        # Ensure standard roles exist
        roles = ['Admin', 'Owner', 'Manager', 'Staff', 'Accounts', 'ED', 'Member']
        for role_name in roles:
            if not Role.query.filter_by(name=role_name).first():
                db.session.add(Role(name=role_name))
        db.session.commit()

        # Create/Update admin user
        email = "admin@shk.com"
        admin_role = Role.query.filter_by(name='Admin').first()
        
        existing_user = User.query.filter((User.email == email) | (User.username == email)).first()
        if not existing_user:
            admin_user = User(
                username=email,
                email=email,
                role_id=admin_role.id if admin_role else None
            )
            admin_user.set_password("admin123")
            db.session.add(admin_user)
            db.session.commit()
            print(f"Admin user created: {email} / admin123")
        else:
            if admin_role:
                existing_user.role_id = admin_role.id
            existing_user.set_password("admin123")
            db.session.commit()
            print(f"User {email} reset to Admin with default password.")

if __name__ == "__main__":
    create_admin()
