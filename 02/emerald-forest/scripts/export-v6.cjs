const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const base64 = file => fs.readFileSync(path.join(root, file)).toString('base64');
const image = file => 'data:image/png;base64,' + base64(file);
const assets = {
  bundle: base64('assets/vision/vision_bundle.mjs'),
  model: base64('assets/vision/blaze_face_short_range.tflite'),
  handModel: base64('assets/vision/hand_landmarker.task'),
  simdLoader: base64('assets/vision/vision_wasm_internal.js'),
  simdWasm: base64('assets/vision/vision_wasm_internal.wasm'),
  nosimdLoader: base64('assets/vision/vision_wasm_nosimd_internal.js'),
  nosimdWasm: base64('assets/vision/vision_wasm_nosimd_internal.wasm'),
};
const css = read('style.css')
  .replace(/^@import[^;]+;\s*/, '')
  .replace("url('assets/forest-storybook-v1.png')", `url('${image('assets/forest-storybook-v1.png')}')`);
const js = read('app.js')
  .replace("'./assets/fairy-storybook-v1.png'", JSON.stringify(image('assets/fairy-storybook-v1.png')))
  .replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace('<title>빛이 머무는 숲 · Emerald Reverie</title>', '<title>빛이 머무는 숲 · Fairy Forest v6</title>')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script id="embedded-vision" type="application/json">${JSON.stringify(assets)}</script>\n<script type="module">\n${js}\n</script>`);
for (const output of [path.join(root, 'fairy-forest-v6.html'), path.join(root, '..', 'fairy-forest-v6.html')]) {
  fs.writeFileSync(output, html, 'utf8');
  console.log(`Saved ${output} (${fs.statSync(output).size} bytes)`);
}
