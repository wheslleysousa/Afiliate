async function test() {
  try {
    const res = await fetch("https://open-api.affiliate.shopee.com.br/api/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{}" })
    });
    console.log("BR API V1 Status:", res.status);
    console.log("BR API V1 Body:", await res.text());
  } catch(e) {
    console.error("BR API V1 Fetch failed:", e.cause);
  }
}
test();
