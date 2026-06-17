import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = path.join(root, "logo.png");
const pngPath = path.join(root, "assets", "icon.png");
const publicPngPath = path.join(root, "public", "icon.png");
const icoPath = path.join(root, "assets", "icon.ico");

if (fs.existsSync(logoPath)) {
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicPngPath), { recursive: true });
  fs.copyFileSync(logoPath, pngPath);
  fs.copyFileSync(logoPath, publicPngPath);
}

if (!fs.existsSync(pngPath)) {
  console.error(`PNG nao encontrado: ${pngPath}`);
  process.exit(1);
}

const ico = await pngToIco(pngPath);
fs.writeFileSync(icoPath, ico);
console.info(`Icone gerado: ${icoPath}`);
