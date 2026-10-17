import { build } from 'esbuild';
await build({entryPoints:[new URL('entry.js',import.meta.url).pathname],bundle:true,platform:'browser',format:'esm',target:'es2020',minify:true,legalComments:'inline',outfile:new URL('../../vendor/ecash-sdk-4.14.4.js',import.meta.url).pathname});
