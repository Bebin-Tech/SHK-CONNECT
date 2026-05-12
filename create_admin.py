from app import app
from models import db, User, Role
from werkzeug.security import generate_password_hash

def create_admin():
    with app.app_context():
        # Initialize database tables
        db.create_all()
        
        # Ensure Admin role exists
        admin_role = Role.query.filter_by(name='Admin').first()
        if not admin_role:
            admin_role = Role(name='Admin')
            db.session.add(admin_role)
            db.session.commit()
            print("Created Admin role.")

        # Create admin user
        email = "admin@shkindustries.com"
        existing_user = User.query.filter_by(email=email).first()
        
        if not existing_user:
            admin_user = User(
                username="SystemAdmin",
                email=email,
                password_hash=generate_password_hash("admin123"),
                role_id=admin_role.id
            )
            db.session.add(admin_user)
            db.session.commit()
            print(f"Admin user created: {email} / admin123")
        else:
            existing_user.role_id = admin_role.id
            db.session.commit()
            print(f"User {email} updated to Admin role.")

if __name__ == "__main__":
    create_admin()
