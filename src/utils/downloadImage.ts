export async function downloadImage(imageUrl: string, productTitle: string): Promise<void> {
  const filename = productTitle
    .split(" ")
    .slice(0, 4)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .concat(".jpg");

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    window.open(imageUrl, "_blank");
  }
}
