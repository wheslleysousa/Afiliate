const http = require('http');

async function test() {
  const url = "https://produto.mercadolivre.com.br/MLB-2779830501-iphone-13-128gb-meia-noite-tela-61-12mp-ios-apple-_JM";
  console.log("Scraping...");
  try {
    const res = await fetch("http://localhost:3000/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });
    console.log(res.status);
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
