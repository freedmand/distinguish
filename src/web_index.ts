import {VirtualFs} from './virtual-fs';
import {DistinguishConfig, Distinguisher} from './distinguisher';

function toggleSrcIndex(toggleClass: string): string {
  return `
<link rel="stylesheet" href="toggle/toggle.css">

<style>
  .${toggleClass} {
    background: green;
  }
</style>

<div class="${toggleClass}"></div>

<script src="toggle/toggle.js"></script>`;
}

function toggleToggleCss(toggleClass: string): string {
  return `
  .${toggleClass} {
    background: blue;
  }`;
}

function toggleToggleJs(toggleClass: string): string {
  return `
  // Create a toggle element from scratch.
  const div = document.createElement('div');
  div.classList.add('${toggleClass}');
  
  // Code to render it.
  ...`;
}

const fs = new VirtualFs();
fs.writeFileSync('/src/index.html', toggleSrcIndex('_cls-toggle'));
fs.writeFileSync('/src/toggle/toggle.css', toggleToggleCss('_cls-toggle'));
fs.writeFileSync('/src/toggle/toggle.js', toggleToggleJs('_cls-toggle'));

fs.writeFileSync('/src/toggle/.namespec', 'namespace toggle');

const config: DistinguishConfig = {
  inputDir: '/src/',
  outputDir: '/out/',
  incrementer: 'minimal',
  types: ['cls', 'id'],
  exclude: [],
};

const d = new Distinguisher(config, fs, fs.dirname);
d.run();

for (const file of [
  '/out/index.html',
  '/out/toggle/toggle.css',
  '/out/toggle/toggle.js',
]) {
  console.log(file, fs.readFileSync(file).toString());
}
