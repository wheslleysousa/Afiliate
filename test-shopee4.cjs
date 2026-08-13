const crypto = require('crypto');
async function test() {
  const appId = "84074251268"; // random
  const secret = "secret";
  const payloadStr = JSON.stringify({ query: "{}" });
  const timestamp = Math.floor(Date.now() / 1000);
  const message = appId + timestamp + payloadStr;
  const hmacSig = crypto.createHmac("sha256", secret).update(message).digest("hex");
  
  try {
    const res = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${hmacSig}`
        },
        body: payloadStr
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error("Fetch failed:", e.cause);
  }
}
test();
