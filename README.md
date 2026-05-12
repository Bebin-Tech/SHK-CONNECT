# Shk Industries Work Flow (Flask Edition)

A real-time team communication platform built with Python Flask, MySQL, and Socket.io.

## 🚀 Features

- **Real-time Messaging**: Instant communication via WebSockets (Flask-SocketIO).
- **Workspace & Channel Management**: Organise teams into workspaces and public/private channels.
- **Authentication**: Secure login/signup with session management.
- **Typing Indicators**: See who's typing in real-time.
- **Premium UI**: Modern Slack-style interface with dark mode and Tailwind CSS.
- **Responsive Design**: Works on mobile and desktop.

## 🛠️ Tech Stack

- **Backend**: Python 3.14+, Flask, SQLAlchemy, Flask-SocketIO.
- **Frontend**: HTML5, Tailwind CSS (via CDN), JavaScript.
- **Database**: MySQL (Fallback to SQLite for testing).

## 📥 Installation

1. **Install Python Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

2. **Set up Environment**:
   Create a `.env` file or use the defaults in `app.py`.

3. **Initialize Database**:
   The app will automatically create a `shk_work_flow.db` (SQLite) on first run for testing. To use MySQL, update `SQLALCHEMY_DATABASE_URI` in `app.py`.

4. **Run the Application**:
   ```powershell
   python app.py
   ```
   Open **http://localhost:5000** in your browser.

## 🐳 Docker Setup

Run the entire stack (including MySQL) using Docker:
```bash
docker-compose up --build
```

## 📂 Project Structure

- `app.py`: Main application and socket handlers.
- `models.py`: Database schema and ORM models.
- `templates/`: HTML templates for UI.
- `static/js/`: Client-side JavaScript.
- `static/css/`: Custom CSS.
- `static/uploads/`: Directory for file attachments.
