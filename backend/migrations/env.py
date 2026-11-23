from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine
from backend.app.core.config import get_settings
from backend.app.db import Base
from backend.app import models

fileConfig(context.config.config_file_name)
target_metadata = Base.metadata
url = get_settings().database_url

if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(url).connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
