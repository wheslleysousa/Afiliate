import httpx
from parsel import Selector
from scrapers.base import DEFAULT_HEADERS, clean_price, clean_title

async def scrape(client: httpx.AsyncClient, url: str) -> dict:
    print(f"[Shein] Scraping URL: {url}")
    headers = {
        **DEFAULT_HEADERS,
        "Cookie": "currency=BRL; language=pt-BR; country=BR; store_code=ptbr"
    }
    
    response = await client.get(url, headers=headers)
    sel = Selector(text=response.text)
    
    title = (
        sel.css('.product-intro__head-name::text').get() or
        sel.css('h1.goods-name::text').get() or
        sel.css('meta[property="og:title"]::attr(content)').get()
    )
    
    image_url = (
        sel.css('.crop-image-container img::attr(src)').get() or
        sel.css('.main-swiper img::attr(src)').get() or
        sel.css('meta[property="og:image"]::attr(content)').get()
    )
    if image_url and image_url.startswith("//"):
        image_url = "https:" + image_url
        
    price_to_raw = (
        sel.css('.product-intro__head-mainprice .from::text').get() or
        sel.css('.she-price-detail .medium::text').get() or
        sel.css('meta[property="product:price:amount"]::attr(content)').get()
    )
    
    price_from_raw = (
        sel.css('.product-intro__head-mainprice del::text').get() or
        sel.css('[class*="original"]::text').get()
    )
    
    price_to = clean_price(price_to_raw) if price_to_raw else "0,00"
    price_from = clean_price(price_from_raw) if price_from_raw else None
    
    return {
        "title": clean_title(title or ""),
        "image_url": image_url,
        "price_from": price_from if price_from != price_to else None,
        "price_to": price_to,
        "installments": None,
        "coupon": None
    }
