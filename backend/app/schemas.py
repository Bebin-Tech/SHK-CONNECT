from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Role = Literal['Admin', 'Owner', 'ED', 'Manager', 'Staff', 'Accounts', 'Member']


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Login(Input):
    identifier: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)
    # Web uses an HttpOnly refresh cookie; native clients use protected storage.
    native: bool = False


class Register(Input):
    username: str = Field(min_length=2, max_length=100, pattern=r'^[a-zA-Z0-9_.-]+$')
    email: EmailStr = Field(max_length=120)
    password: str = Field(min_length=12, max_length=256)
    first_name: str = Field(default='', max_length=100)
    last_name: str = Field(default='', max_length=100)

    @field_validator('username', 'email')
    @classmethod
    def normalized_identity(cls, value):
        return value.lower()


class CreateUser(Register):
    role: Role = 'Member'


class UserEdit(Input):
    role: Role
    is_active: bool


class Profile(Input):
    email: EmailStr = Field(max_length=120)
    first_name: str = Field(default='', max_length=100)
    last_name: str = Field(default='', max_length=100)
    current_password: str | None = Field(default=None, max_length=256)
    new_password: str | None = Field(default=None, min_length=12, max_length=256)


class Refresh(Input):
    refresh_token: str | None = Field(default=None, max_length=4096)


class ChannelInput(Input):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=255)


class ChannelEdit(ChannelInput):
    is_archived: bool = False


class MembersInput(Input):
    user_ids: list[int] = Field(max_length=500)


class MessageInput(Input):
    content: str = Field(default='', max_length=10000)
    parent_id: int | None = Field(default=None, gt=0)
    attachment_id: str | None = Field(default=None, max_length=36)
    client_id: str = Field(min_length=1, max_length=64)


class Cursor(Input):
    last_message_id: int = Field(ge=0)


class Heartbeat(Input):
    conversation: str = Field(default='', max_length=50, pattern=r'^(|channel:\d+|dm:\d+)$')
    typing: bool = False
