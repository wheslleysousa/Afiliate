import re

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "mercadolivre.com" in url_lower or "mercadolibre.com" in url_lower or "mliv.re" in url_lower:
        return "mercadolivre"
    elif "shopee.com.br" in url_lower or "s.shopee.com.br" in url_lower or "shopee.cl" in url_lower:
        return "shopee"
    elif "amazon.com.br" in url_lower or "amzn.to" in url_lower or "amazon.com" in url_lower:
        return "amazon"
    elif "aliexpress.com" in url_lower or "s.click.aliexpress" in url_lower or "a.aliexpress" in url_lower:
        return "aliexpress"
    elif "shein.com" in url_lower or "shein.com.br" in url_lower:
        return "shein"
    else:
        raise ValueError("Plataforma não suportada. Use links do ML, Shopee, Amazon, AliExpress ou Shein.")

def clean_price(value: str | float | int) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, (int, float)):
        return f"{value:.2f}".replace(".", ",")
    
    val_str = str(value).strip()
    val_str = re.sub(r'[^\d,.]', '', val_str)
    
    if "." in val_str and "," in val_str:
        val_str = val_str.replace(".", "").replace(",", ".")
    elif "," in val_str and "." not in val_str:
        val_str = val_str.replace(",", ".")
        
    try:
        num = float(val_str)
        return f"{num:.2f}".replace(".", ",")
    except ValueError:
        return val_str

def clean_title(title: str) -> str:
    if not title:
        return ""
    cleaned = re.sub(r'\s+', ' ', title).strip()
    return cleaned
