import re
import json
import httpx
from parsel import Selector
from scrapers.base import DEFAULT_HEADERS, clean_price, clean_title

async def scrape(client: httpx.AsyncClient, url: str) -> dict:
    print(f"[AliExpress] Scraping URL: {url}")
    headers = {
        **DEFAULT_HEADERS,
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8"
    }
    
    response = await client.get(url, headers=headers)
    final_url = str(response.url)
    
    pid_match = re.search(r'/item/(\d+)\.html', final_url)
    if not pid_match:
        pid_match = re.search(r'/item/(\d+)\.html', url)
        
    if pid_match:
        pid = pid_match.group(1)
        canonical_url = f"https://www.aliexpress.com/item/{pid}.html"
        response = await client.get(canonical_url, headers=headers)
        
    match_json = re.search(r'window\.runParams\s*=\s*(\{.*?\});', response.text, re.DOTALL)
    if match_json:
        try:
            raw_data = json.loads(match_json.group(1))
            data_component = raw_data.get("data", {}).get("productInfoComponent", {})
            if data_component:
                title = clean_title(data_component.get("subject", ""))
                
                prices = data_component.get("prices", {})
                sale_price_obj = prices.get("salePrice", {})
                orig_price_obj = prices.get("originalPrice", {})
                
                price_to = sale_price_obj.get("formattedPrice") or clean_price(sale_price_obj.get("minPrice", 0))
                price_from = orig_price_obj.get("formattedPrice") or clean_price(orig_price_obj.get("minPrice", 0))
                
                if price_from == price_to:
                    price_from = None
                    
                images = data_component.get("imagePathList", [])
                image_url = images[0] if images else None
                if image_url and image_url.startswith("//"):
                    image_url = "https:" + image_url
                    
                return {
                    "title": title,
                    "image_url": image_url,
                    "price_from": price_from,
                    "price_to": clean_price(price_to or "0,00"),
                    "installments": None,
                    "coupon": None
                }
        except Exception as e:
            print(f"[AliExpress] Erro ao decodificar window.runParams: {e}")

    # Fallback Parsel
    print("[AliExpress] Executando fallback HTML com Parsel")
    sel = Selector(text=response.text)
    title = sel.css('.product-title-text::text').get() or sel.css('h1[class*="title"]::text').get() or sel.css('meta[property="og:title"]::attr(content)').get()
    image_url = sel.css('.magnifier-image::attr(src)').get() or sel.css('[class*="main-img"]::attr(src)').get() or sel.css('meta[property="og:image"]::attr(content)').get()
    if image_url and image_url.startswith("//"):
        image_url = "https:" + image_url
        
    price = sel.css('[class*="product-price-value"]::text').get() or sel.css('meta[property="product:price:amount"]::attr(content)').get()
    
    return {
        "title": clean_title(title or ""),
        "image_url": image_url,
        "price_from": None,
        "price_to": clean_price(price or "0,00"),
        "installments": None,
        "coupon": None
    }
