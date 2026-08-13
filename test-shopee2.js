async function test() {
  try {
    const res = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{}" })
    });
    console.log("BR Status:", res.status);
    console.log("BR Body:", await res.text());
  } catch(e) {
    console.error("BR Fetch failed:", e.cause);
  }
}
test();
