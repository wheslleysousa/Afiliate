async function test() {
  try {
    const res = await fetch("https://open-api.affiliate.shopee.com.br/api/v1/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "SHA256 Credential=fake,Timestamp=123,Signature=fake",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        },
        body: JSON.stringify({ query: "{ generatePromotionLink(originLines: [\"https://shopee.com.br/product/123/456\"]) { errCode errMsg } }" })
    });
    console.log("BR API V1 Status:", res.status);
    console.log("BR API V1 Body:", await res.text());
  } catch(e) {
    console.error("BR API V1 Fetch failed:", e.cause);
  }
}
test();
