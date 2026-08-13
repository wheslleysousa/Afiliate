async function test() {
  try {
    const res = await fetch("https://open-api.affiliate.shopee.com/api/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{}" })
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error("Fetch failed:", e);
  }
}
test();
