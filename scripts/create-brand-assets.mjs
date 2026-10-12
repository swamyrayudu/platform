import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const source = await fs.readFile(path.join(root, 'public/rsd-logo.svg'));
  const mobileAssets = path.join(root, 'mobile/assets');
  await fs.mkdir(mobileAssets, { recursive: true });
  await sharp(source).resize(512, 512).png().toFile(path.join(mobileAssets, 'brand-mark.png'));
  // Launcher icons need an opaque background; in-app marks keep transparency.
  await sharp(source).resize(1024, 1024).flatten({background:'#2E2B55'}).png().toFile(path.join(mobileAssets, 'icon.png'));
  // Keep the book and sun inside Android's mask-safe region. The configured
  // indigo background supplies the tile behind this transparent foreground.
  const glyph = Buffer.from(source.toString().replace(/<rect\b[^>]*\/>/, ''));
  await sharp(glyph).resize(820, 820).extend({top:102,bottom:102,left:102,right:102,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(mobileAssets, 'adaptive-icon.png'));
  await fs.writeFile(path.join(root, 'app/icon.svg'), source);
  await sharp(source).resize(512, 512).png().toFile(path.join(root, 'public/rsd-logo.png'));

  const sizes = [32, 48, 256];
  const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    directory[entry] = sizes[index] === 256 ? 0 : sizes[index];
    directory[entry + 1] = directory[entry];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.writeFile(path.join(root, 'app/favicon.ico'), Buffer.concat([directory, ...images]));
  console.log('Created app marks, launcher icons and website/browser assets from public/rsd-logo.svg.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
