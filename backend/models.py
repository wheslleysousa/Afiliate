from pydantic import BaseModel, HttpUrl, validator
from typing import Optional

class ScrapeRequest(BaseModel):
    url: str

    @validator("url")
    def validate_url(cls, v):
        v = v.strip()
        if not v.startswith("http://") and not v.startswith("https://"):
            raise ValueError("URL inválida. A URL deve começar com http:// ou https://")
        return v

class ScrapeResponse(BaseModel):
    platform: str
    title: str
    image_url: Optional[str] = None
    price_from: Optional[str] = None
    price_to: str
    installments: Optional[str] = None
    coupon: Optional[str] = None
    original_link: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
