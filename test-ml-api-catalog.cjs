async function test() {
  const appId = "1096973158666349";
  const clientSecret = "5YoWCSRNr90KiVumj0tf35NGkpOAbops";

  console.log("Getting token...");
  const ccRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: appId,
      client_secret: clientSecret,
    }),
  });
  
  const tokenData = await ccRes.json();
  if (tokenData.access_token) {
    const apiRes = await fetch("https://api.mercadolibre.com/items/MLB3368297055?include_attributes=all", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`
      }
    });
    console.log("Item status:", apiRes.status);
    const itemData = await apiRes.json();
    console.log("Item:", itemData.status, itemData.error);
  }
}
test();
