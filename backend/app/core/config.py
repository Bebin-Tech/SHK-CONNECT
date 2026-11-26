from functools import lru_cache
from pathlib import Path
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    environment: str = 'development'
    database_url: str = f'sqlite:///{(ROOT / "instance" / "connect_v2.db").as_posix()}'
    jwt_secret: str = Field(min_length=32)
    jwt_issuer: str = 'shk-connect'
    jwt_audience: str = 'shk-clients'
    access_minutes: int = Field(default=15, ge=1, le=60)
    refresh_days: int = Field(default=30, ge=1, le=90)
    cors_origins: list[str] = ['http://localhost:5000', 'http://localhost:8080', 'http://127.0.0.1:5000']
    allowed_hosts: list[str] = ['localhost', '127.0.0.1', 'testserver']
    cookie_secure: bool = False
    allow_registration: bool = False
    upload_dir: Path = ROOT / 'instance' / 'private_uploads'
    web_dir: Path = ROOT / 'client' / 'build' / 'web'
    max_upload_bytes: int = 20 * 1024 * 1024
    firebase_service_account_json: SecretStr | None = None

    @field_validator('database_url', mode='before')
    @classmethod
    def postgres_driver(cls, value):
        for prefix in ('postgres://', 'postgresql://'):
            if value.startswith(prefix):
                return value.replace(prefix, 'postgresql+psycopg://', 1)
        return value

    @model_validator(mode='after')
    def production(self):
        if self.environment == 'production':
            if not self.database_url.startswith('postgresql+psycopg://'):
                raise ValueError('Production requires PostgreSQL (postgresql+psycopg://)')
            if not self.cookie_secure or '*' in self.cors_origins or '*' in self.allowed_hosts:
                raise ValueError('Production requires secure cookies and explicit origins/hosts')
            if self.jwt_secret.startswith('replace'):
                raise ValueError('Replace the example signing secret')
        return self


@lru_cache
def get_settings():
    return Settings()
