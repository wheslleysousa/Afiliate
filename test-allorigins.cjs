async function test() {
  const url = "https://produto.mercadolivre.com.br/MLB-2779830501-iphone-13-128gb-meia-noite-tela-61-12mp-ios-apple-_JM";
  const proxyRes = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(url));
  const proxyData = await proxyRes.json();
  const html = proxyData.contents;
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  console.log("Title meta:", $('meta[property="og:title"]').attr('content'));
  console.log("Title tag:", $('title').text());
}
test();
