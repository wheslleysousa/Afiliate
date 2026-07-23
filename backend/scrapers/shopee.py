import re
import httpx
from parsel import Selector
from scrapers.base import DEFAULT_HEADERS, clean_price, clean_title

async def scrape(client: httpx.AsyncClient, url: str) -> dict:
    print(f"[Shopee] Scraping URL: {url}")
    shopee_headers = {
        **DEFAULT_HEADERS,
        "Referer": "https://shopee.com.br/",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
    }
    
    response = await client.get(url, headers=DEFAULT_HEADERS)
    final_url = str(response.url)
    
    match = re.search(r'-i\.(\d+)\.(\d+)', final_url)
    if not match:
        match = re.search(r'-i\.(\d+)\.(\d+)', url)
    if not match:
        match = re.search(r'product/(\d+)/(\d+)', final_url)
        
    if match:
        shop_id = match.group(1)
        item_id = match.group(2)
        print(f"[Shopee] shopId: {shop_id}, itemId: {item_id}")
        
        api_url = f"https://shopee.com.br/api/v4/item/get?itemid={item_id}&shopid={shop_id}"
        try:
            api_res = await client.get(api_url, headers=shopee_headers)
            if api_res.status_code == 200:
                data = api_res.json()
                item = data.get("data", {}).get("item", {})
                if item:
                    title = clean_title(item.get("name", ""))
                    image = item.get("image", "")
                    image_url = f"https://cf.shopee.com.br/file/{image}" if image else None
                    
                    raw_price = item.get("price", 0) / 100000
                    price_to = clean_price(raw_price)
                    
                    price_before = item.get("price_before_discount", 0) / 100000
                    price_from = None
                    if price_before > raw_price:
                        price_from = clean_price(price_before)
                        
                    installments_str = None
                    inst_info = item.get("installment_info")
                    if inst_info and isinstance(inst_info, dict):
                        plans = inst_info.get("installment_plan", [])
                        if plans:
                            last_plan = plans[-1]
                            month = last_plan.get("month")
                            price_per_month = last_plan.get("price_per_month", 0) / 100000
                            installments_str = f"{month}x de R$ {clean_price(price_per_month)}"
                            
                    return {
                        "title": title,
                        "image_url": image_url,
                        "price_from": price_from,
                        "price_to": price_to,
                        "installments": installments_str,
                        "coupon": None
                    }
        except Exception as e:
            print(f"[Shopee] Erro na API interna: {e}")

    # Fallback Parsel
    print("[Shopee] Executando fallback HTML com Parsel")
    sel = Selector(text=response.text)
    title = sel.css('meta[property="og:title"]::attr(content)').get() or ""
    image_url = sel.css('meta[property="og:image"]::attr(content)').get()
    price = sel.css('meta[property="product:price:amount"]::attr(content)').get()
    
    return {
        "title": clean_title(title),
        "image_url": image_url,
        "price_from": None,
        "price_to": clean_price(price or "0,00"),
        "installments": None,
        "coupon": None
    }
