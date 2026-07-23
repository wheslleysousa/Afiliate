import re
import httpx
from parsel import Selector
from scrapers.base import DEFAULT_HEADERS, clean_price, clean_title

async def scrape(client: httpx.AsyncClient, url: str) -> dict:
    print(f"[Amazon] Scraping URL: {url}")
    headers = {
        **DEFAULT_HEADERS,
        "Cookie": "session-id=000-0000000-0000000; i18n-prefs=BRL"
    }
    
    response = await client.get(url, headers=headers)
    final_url = str(response.url)
    
    asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', final_url, re.IGNORECASE)
    if not asin_match:
        asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url, re.IGNORECASE)
        
    canonical_url = final_url
    if asin_match:
        asin = asin_match.group(1).upper()
        canonical_url = f"https://www.amazon.com.br/dp/{asin}"
        if canonical_url != final_url:
            response = await client.get(canonical_url, headers=headers)
            
    sel = Selector(text=response.text)
    
    title = sel.css('#productTitle::text').get() or sel.css('meta[name="title"]::attr(content)').get()
    title = clean_title(title or "")
    
    if not title or "CAPTCHA" in response.text.upper() or "ROBOT CHECK" in response.text.upper():
        raise ValueError("Amazon bloqueou a requisição com CAPTCHA. Tente novamente em alguns segundos.")
        
    image_url = (
        sel.css('#landingImage::attr(src)').get() or
        sel.css('#landingImage::attr(data-old-hires)').get() or
        sel.css('#imgTagWrapperId img::attr(src)').get() or
        sel.css('meta[property="og:image"]::attr(content)').get()
    )
    
    whole = sel.css('span.a-price:first-child .a-price-whole::text').get()
    fraction = sel.css('span.a-price:first-child .a-price-fraction::text').get()
    price_to = None
    if whole:
        whole_clean = whole.replace(".", "").replace(",", "").strip()
        frac_clean = (fraction or "00").strip()
        price_to = f"{whole_clean},{frac_clean}"
    else:
        offscreen = sel.css('.a-price .a-offscreen::text').get()
        if offscreen:
            price_to = clean_price(offscreen)
            
    price_from_raw = sel.css('.a-text-price .a-offscreen::text').get() or sel.css('#priceblock_dealprice + .a-text-strike .a-offscreen::text').get()
    price_from = clean_price(price_from_raw) if price_from_raw else None
    
    installments_text = sel.css('#installmentCalculator_feature_div::text').get() or sel.css('.best-offer-name::text').get()
    installments = clean_title(installments_text) if installments_text else None
    
    return {
        "title": title,
        "image_url": image_url,
        "price_from": price_from if price_from != price_to else None,
        "price_to": price_to or "0,00",
        "installments": installments,
        "coupon": None
    }
