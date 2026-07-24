async function test() {
  const apiRes = await fetch("https://api.mercadolibre.com/items/MLB3368297055");
  console.log("Item status:", apiRes.status);
  const text = await apiRes.text();
  console.log("Body:", text);
}
test();
