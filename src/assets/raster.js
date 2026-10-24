// Artwork decoding is shared data preparation, independent of either drawing backend.
export async function rasterArt(markup, viewBox, width = 256, height = 384) {
  const image = new Image();
  image.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="none">${markup}</svg>`,
    );
  await image.decode();
  // Decode SVG artwork once. Passing the SVG image to drawImage would replay its
  // vector tree for every clipped perspective triangle, at the full scene DPR.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}
