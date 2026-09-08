/**
 * Copies the iTowns browser bundles out of node_modules into vendor/itowns/,
 * so the pages under src/ can load them with a plain <script> tag.
 *
 * Run through `npm install` (postinstall) or `npm run vendor:itowns`.
 * The version served is the one pinned in package.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLES = ['itowns.umd.js', 'debug.umd.js'];

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = join(projectRoot, 'vendor', 'itowns');

// itowns does not export ./package.json, so read it straight out of node_modules.
const itownsRoot = join(projectRoot, 'node_modules', 'itowns');
const distDir = join(itownsRoot, 'dist');
const { version } = JSON.parse(await readFile(join(itownsRoot, 'package.json'), 'utf8'));

await mkdir(targetDir, { recursive: true });

for (const bundle of BUNDLES) {
    const source = await readFile(join(distDir, bundle), 'utf8');
    // The .map files are not vendored, so drop the reference to avoid a 404 per page load.
    const stripped = source.replace(/\n?\/\/# sourceMappingURL=.*\n?$/, '\n');
    await writeFile(join(targetDir, bundle), stripped);
}

await writeFile(
    join(targetDir, 'VERSION'),
    `itowns ${version}\nvendored from node_modules/itowns/dist by scripts/vendor-itowns.mjs\n`,
);

console.log(`vendor/itowns: itowns ${version} (${BUNDLES.join(', ')})`);
