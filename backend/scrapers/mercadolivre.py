import re
import httpx
from parsel import Selector
from scrapers.base import DEFAULT_HEADERS, clean_price, clean_title

async def scrape(client: httpx.AsyncClient, url: str) -> dict:
    print(f"[MercadoLivre] Scraping: {url}")
    response = await client.get(url, headers=DEFAULT_HEADERS)
    final_url = str(response.url)
    
    item_id_match = re.search(r'(MLB\d+)', final_url, re.IGNORECASE)
    if not item_id_match:
        item_id_match = re.search(r'(MLB\d+)', url, re.IGNORECASE)
        
    if item_id_match:
        item_id = item_id_match.group(1).upper()
        api_url = f"https://api.mercadolibre.com/items/{item_id}"
        print(f"[MercadoLivre] ID encontrado: {item_id}. Chamando API publica: {api_url}")
        
        try:
            api_res = await client.get(api_url, headers={"Accept": "application/json"})
            if api_res.status_code == 200:
                data = api_res.json()
                
                title = clean_title(data.get("title", ""))
                
                image_url = None
                pictures = data.get("pictures", [])
                if pictures and len(pictures) > 0:
                    image_url = pictures[0].get("url")
                if not image_url:
                    image_url = data.get("thumbnail")
                    
                price_to = clean_price(data.get("price"))
                
                orig_price = data.get("original_price")
                price_from = None
                if orig_price and float(orig_price) > float(data.get("price", 0)):
                    price_from = clean_price(orig_price)
                    
                installments_str = None
                inst_data = data.get("installments")
                if inst_data:
                    q = inst_data.get("quantity")
                    amt = inst_data.get("amount")
                    no_interest = inst_data.get("rate") == 0
                    if q and amt:
                        amt_formatted = clean_price(amt)
                        interest_text = " sem juros" if no_interest else ""
                        installments_str = f"{q}x de R$ {amt_formatted}{interest_text}"
                        
                coupon = None
                sale_terms = data.get("sale_terms", [])
                for term in sale_terms:
                    if term.get("id") == "COUPON":
                        coupon = term.get("value_name")
                        break
                        
                return {
                    "title": title,
                    "image_url": image_url,
                    "price_from": price_from,
                    "price_to": price_to or "0,00",
                    "installments": installments_str,
                    "coupon": coupon
                }
        except Exception as e:
            print(f"[MercadoLivre] Erro na API publica ML: {e}")
            
    # Fallback Parsel HTML
    print("[MercadoLivre] Executando fallback HTML com Parsel")
    sel = Selector(text=response.text)
    title = sel.css('meta[property="og:title"]::attr(content)').get() or sel.css('h1::text').get() or ""
    image_url = sel.css('meta[property="og:image"]::attr(content)').get()
    
    price_to_raw = sel.css('meta[property="product:price:amount"]::attr(content)').get() or sel.css('.ui-pdp-price__part--medium .andes-money-amount__fraction::text').get()
    
    return {
        "title": clean_title(title),
        "image_url": image_url,
        "price_from": None,
        "price_to": clean_price(price_to_raw or "0,00"),
        "installments": None,
        "coupon": None
    }
