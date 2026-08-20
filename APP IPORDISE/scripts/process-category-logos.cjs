const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'tmp', 'imagegen', 'category-logos-v1');
const outputDir = path.join(root, 'assets', 'category-logos');
const names = ['men', 'women', 'unisex', 'luxury', 'new-arrivals', 'offers'];

fs.mkdirSync(outputDir, { recursive: true });

for (const name of names) {
  const source = PNG.sync.read(fs.readFileSync(path.join(sourceDir, `${name}-source.png`)));
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const r = source.data[index];
      const g = source.data[index + 1];
      const b = source.data[index + 2];
      // The generated marks are ruby red on a green chroma background. Color
      // dominance is more robust than sampling one green pixel because image
      // generation introduces slight variation across an otherwise flat field.
      const redDominance = r - g;
      const alpha = redDominance <= -20 ? 0 : redDominance >= 30 ? 255 : Math.round(((redDominance + 20) / 50) * 255);

      source.data[index + 3] = alpha;
      if (alpha > 0 && g > Math.max(r, b)) source.data[index + 1] = Math.min(g, Math.round((r + b) / 2));
      if (alpha > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) throw new Error(`No visible logo content found for ${name}`);
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = Math.max(8, Math.round(Math.max(contentWidth, contentHeight) * 0.1));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(source.width - 1, maxX + padding);
  const bottom = Math.min(source.height - 1, maxY + padding);
  const output = new PNG({ width: right - left + 1, height: bottom - top + 1 });

  PNG.bitblt(source, output, left, top, output.width, output.height, 0, 0);
  const outputPath = path.join(outputDir, `ipordise-${name}-mark-v1.png`);
  fs.writeFileSync(outputPath, PNG.sync.write(output));
  process.stdout.write(`${name}: ${output.width}x${output.height}\n`);
}
