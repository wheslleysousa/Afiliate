from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
from scrapers.base import detect_platform
from scrapers import mercadolivre, shopee, amazon, aliexpress, shein
from models import ScrapeRequest, ScrapeResponse, ErrorResponse

app = FastAPI(
    title="AfiliaCopy API",
    version="1.0.0",
    description="API de extração de dados de produtos para afiliados"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/scrape", response_model=ScrapeResponse, responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}})
async def scrape_product(request: ScrapeRequest):
    try:
        platform = detect_platform(request.url)
        print(f"[AfiliaCopy API] Plataforma detectada: {platform} para {request.url}")
        
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            scraper_map = {
                "mercadolivre": mercadolivre.scrape,
                "shopee": shopee.scrape,
                "amazon": amazon.scrape,
                "aliexpress": aliexpress.scrape,
                "shein": shein.scrape,
            }
            scraper = scraper_map[platform]
            result = await scraper(client, request.url)
            result["platform"] = platform
            result["original_link"] = request.url
            return ScrapeResponse(**result)
            
    except ValueError as e:
        print(f"[AfiliaCopy API Error] 422: {e}")
        raise HTTPException(status_code=422, detail={"error": "Não foi possível extrair os dados. Verifique se o link é válido.", "detail": str(e)})
    except Exception as e:
        print(f"[AfiliaCopy API Error] 500: {e}")
        raise HTTPException(status_code=500, detail={"error": "Erro ao extrair dados do produto.", "detail": str(e)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=10000, reload=True)
