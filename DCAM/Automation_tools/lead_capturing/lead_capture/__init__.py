import os

from flask import Flask
from dotenv import load_dotenv

from .routes import bp


def create_app() -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret")
    app.register_blueprint(bp)
    return app
