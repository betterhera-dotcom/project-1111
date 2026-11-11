const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const image = file => 'data:image/png;base64,' + fs.readFileSync(path.join(root, file)).toString('base64');
let css = read('style.css').replace("url('assets/forest-storybook-v1.png')", `url('${image('assets/forest-storybook-v1.png')}')`);
let js = read('app.js').replace("'./assets/fairy-storybook-v1.png'", JSON.stringify(image('assets/fairy-storybook-v1.png')));
js = js.replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace('<title>빛이 머무는 숲 · Emerald Reverie</title>', '<title>빛이 머무는 숲 · Fairy Forest v2</title>')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="module">\n${js}\n</script>`);
const output = path.join(root, 'fairy-forest-v2.html');
fs.writeFileSync(output, html, 'utf8');
console.log(`Saved ${output} (${fs.statSync(output).size} bytes)`);
const connectedOutput = path.join(root, '..', 'fairy-forest-v2.html');
fs.writeFileSync(connectedOutput, html.replaceAll('./assets/vision', './emerald-forest/assets/vision'), 'utf8');
console.log(`Saved ${connectedOutput}`);
