async function test() {
  const appId = "1096973158666349";
  const clientSecret = "5YoWCSRNr90KiVumj0tf35NGkpOAbops";

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
  
  const apiRes = await fetch("https://api.mercadolibre.com/sites/MLB/search?q=celular", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`
    }
  });
  console.log("Search status:", apiRes.status);
  const text = await apiRes.text();
  console.log("Body:", text.slice(0, 200));
}
test();
