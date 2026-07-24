async function test() {
  const apiRes = await fetch("https://api.mercadolibre.com/items?ids=MLB2779830501");
  console.log("Status:", apiRes.status);
  const text = await apiRes.text();
  console.log("Body:", text.slice(0, 200));
}
test();
