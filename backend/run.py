"""Start the DCC API.

    python run.py                 # http://127.0.0.1:5000  (creates and seeds the database on first run)
    flask --app run init-db       # recreate the database (empty)
    flask --app run seed          # recreate the database with demo data
"""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host=app.config["HOST"], port=app.config["PORT"], debug=app.config["DEBUG"])
