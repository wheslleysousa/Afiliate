const fs = require('fs');

async function testShopeeExtraction() {
  const url = "https://s.shopee.com.br/6fg6nKGmUi";
  console.log("Input URL:", url);

  // Step 1: Resolve Final URL
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow"
  });
  const finalUrl = res.url;
  const html = await res.text();
  console.log("Final URL:", finalUrl);

  // Step 2: Improved Regex matching for shopId and itemId
  let match = finalUrl.match(/-i\.(\d+)\.(\d+)/) ||
              finalUrl.match(/product\/(\d+)\/(\d+)/) ||
              finalUrl.match(/shopee\.com\.br\/[^\/]+\/(\d{6,15})\/(\d{6,15})/) ||
              finalUrl.match(/\/(\d{6,15})\/(\d{6,15})/);

  if (!match && html) {
    match = html.match(/-i\.(\d+)\.(\d+)/) ||
            html.match(/product\/(\d+)\/(\d+)/) ||
            html.match(/itemid[=":\s]+(\d+)[^"'\n]*shopid[=":\s]+(\d+)/i) ||
            html.match(/"shopid"\s*:\s*(\d+).*?"itemid"\s*:\s*(\d+)/i);
  }

  console.log("Matched shopId/itemId:", match ? `shopId=${match[1]}, itemId=${match[2]}` : "NO MATCH");

  if (match) {
    const shopId = match[1];
    const itemId = match[2];

    const itemApiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
    console.log("Trying item API:", itemApiUrl);
    
    const apiRes = await fetch(itemApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Referer": `https://shopee.com.br/product/${shopId}/${itemId}`,
        "Accept": "application/json, text/plain, */*",
        "X-Shopee-Language": "pt-BR",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": "SPC_SI=1; SPC_U=-; SPC_EC=-; SPC_IA=-; SPC_F=1; SPC_CLIENTID=1;"
      }
    });

    console.log("API Status:", apiRes.status);
    if (apiRes.ok) {
      const json = await apiRes.json();
      console.log("JSON item:", json?.data?.name || json?.item?.name || json?.data?.item?.name);
    }
  }
}

testShopeeExtraction();
