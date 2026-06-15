import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { spawnSync } from "node:child_process";
import path from "node:path";

const runEvsSignPkg = (packageDir: string) => {
  const script = path.resolve(__dirname, "scripts/evs-sign-package.mjs");
  const result = spawnSync(process.execPath, [script, packageDir], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`EVS sign-pkg falhou para ${packageDir}`);
  }
};

const CASTLABS_ELECTRON_RELEASE_BASE =
  "https://github.com/castlabs/electron-releases/releases/download";

const buildCastLabsElectronDownloadUrl = async (details: {
  version: string;
  platform: string;
  arch: string;
  artifactName: string;
}) => {
  const version = details.version.replace(/^v/, "");
  const releaseDir = `${CASTLABS_ELECTRON_RELEASE_BASE}/v${version}`;

  if (details.artifactName !== "electron") {
    return `${releaseDir}/${details.artifactName}`;
  }

  return `${releaseDir}/electron-v${version}-${details.platform}-${details.arch}.zip`;
};

const castLabsPackagerConfig = {
  asar: true,
  executableName: "millennium-desk",
  download: {
    mirrorOptions: {
      resolveAssetURL: buildCastLabsElectronDownloadUrl,
    },
  },
} as ForgeConfig["packagerConfig"];

const config: ForgeConfig = {
  packagerConfig: castLabsPackagerConfig,
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "millennium_desk",
    }),
  ],
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      if (process.env.EVS_SIGN !== "1") return;
      if (packageResult.platform !== "win32" && packageResult.platform !== "darwin") {
        return;
      }

      for (const outputPath of packageResult.outputPaths) {
        console.info(`[EVS] Assinando pacote em ${outputPath}...`);
        runEvsSignPkg(outputPath);
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/entrypoints/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/entrypoints/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
