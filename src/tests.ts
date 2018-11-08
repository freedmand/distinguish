import {Renamer} from './renamer';
import {Tester} from './tester';
import {NamespecParser} from './namespec';
import {MinimalIncrementer, SimpleIncrementer, ModuleIncrementer} from './incrementer';
import {VirtualFs} from './virtual-fs';
import {Distinguisher, DistinguishConfig} from './distinguisher';
import {CLI, CLIResult, RenameOptions} from './cli';

const t = new Tester();

t.test('testBasicNaming', () => {
  const r = new Renamer(MinimalIncrementer, ['cls', 'id']);
  r.addName('cls', 'dog');
  r.addName('cls', 'cat');
  r.addName('cls', 'frog');

  const component = r.namespace('component1');
  component.addName('cls', 'machine');
  r.addName('cls', '1');
  component.addName('cls', 'dog');
  r.addName('cls', '2');
  r.addName('id', 'doggo');

  const rMap = r.namingMaps.get('cls') as Map<string, string>;
  const rIdMap = r.namingMaps.get('id') as Map<string, string>;
  const cMap = component.namingMaps.get('cls') as Map<string, string>;

  t.assertEquals(rMap.get('dog'), 'a');
  t.assertEquals(rMap.get('cat'), 'b');
  t.assertEquals(rMap.get('frog'), 'c');
  t.assertEquals(cMap.get('machine'), 'd');
  t.assertEquals(rMap.get('1'), 'e');
  t.assertEquals(cMap.get('dog'), 'f');
  t.assertEquals(rMap.get('2'), 'g');

  t.assertEquals(rIdMap.get('doggo'), 'a');
});

t.test('deepNamespaces', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  const p3 = r.namespace(['p1', 'p2', 'p3']);
  t.assertEquals(p3.namespaces.join('/'), 'root/p1/p2/p3');

  const p2 = p3.parent as Renamer;
  t.assert(p2);
  t.assertEquals(p2.namespaces.join('/'), 'root/p1/p2');

  const p1 = p2.parent as Renamer;
  t.assert(p1);
  t.assertEquals(p1.namespaces.join('/'), 'root/p1');

  const p0 = p1.parent as Renamer;
  t.assert(p0);
  t.assertEquals(p0, r);
  t.assertEquals(p0.namespaces.join('/'), 'root');
});

t.test('pathSpecToParts', () => {
  t.assertArrayEquals(Renamer.pathSpecToParts('/'), ['/']);
  t.assertArrayEquals(Renamer.pathSpecToParts('dog'), ['dog']);
  t.assertArrayEquals(Renamer.pathSpecToParts('/dog'), ['/', 'dog']);
  t.assertArrayEquals(Renamer.pathSpecToParts('dog/cat'), ['dog', 'cat']);
  t.assertArrayEquals(Renamer.pathSpecToParts('../dog'), ['..', 'dog']);
  t.assertArrayEquals(Renamer.pathSpecToParts('dog/cat/parrot'), [
    'dog',
    'cat',
    'parrot',
  ]);
});

t.test('namespaceSansImports', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  t.assertEquals(r.addName('id', 'dog'), 'a');

  const component = r.namespace('component');
  t.assertEquals(component.addName('id', 'dog'), 'b');
});

t.test('namespaceImportModuleToParent', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  t.assertEquals(r.addName('id', 'dog'), 'a');

  const component = r.namespace('component');
  component.import('..', 'id', 'dog');
  t.assertEquals(component.addName('id', 'dog'), 'a');
});

t.test('namespaceImportParentToModule', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  // Import before module even exists.
  r.import('component', 'id', 'dog');

  t.assertEquals(r.addName('id', 'dog'), 'a');

  const component = r.namespace('component');
  t.assertEquals(component.addName('id', 'dog'), 'a');
});

t.test('namespecBasic', () => {
  const spec = `
namespace slider

from .. import
  css
    slider
`;
  const parser = new NamespecParser(spec);
  const {namespace, imports} = parser.parse();

  t.assertEquals(namespace, 'slider');
  t.assertArrayEquals(Array.from(imports.keys()), ['..']);
  const map = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(map.keys()), ['css']);
  t.assertArrayEquals(Array.from(map.values())[0], ['slider']);
});

t.test('namespecReserves', () => {
  const spec = `
namespace slider

reserve
  css
    cat

from .. import
  css
    slider
`;
  const parser = new NamespecParser(spec);
  const {namespace, imports, reserves} = parser.parse();

  t.assertEquals(namespace, 'slider');

  t.assertArrayEquals(Array.from(reserves.keys()), ['css']);
  t.assertArrayEquals(Array.from(Array.from(reserves.values())[0].values()), ['cat']);

  t.assertArrayEquals(Array.from(imports.keys()), ['..']);
  const map = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(map.keys()), ['css']);
  t.assertArrayEquals(Array.from(map.values())[0], ['slider']);
});

t.test('namespecReservesAtEnd', () => {
  const spec = `
namespace slider

from .. import
  css
    slider

reserve
  css
    cat
`;
  const parser = new NamespecParser(spec);
  const {namespace, imports, reserves} = parser.parse();

  t.assertEquals(namespace, 'slider');

  t.assertArrayEquals(Array.from(imports.keys()), ['..']);
  const map = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(map.keys()), ['css']);
  t.assertArrayEquals(Array.from(map.values())[0], ['slider']);

  t.assertArrayEquals(Array.from(reserves.keys()), ['css']);
  t.assertArrayEquals(Array.from(Array.from(reserves.values())[0].values()), ['cat']);
});

t.test('namespecMultipleValues', () => {
  const spec = `
namespace slider

from .. import
  css
    slider
    oven
    mitten
  id
    dog
    cat
`;
  const parser = new NamespecParser(spec);
  const {namespace, imports} = parser.parse();

  t.assertEquals(namespace, 'slider');
  t.assertArrayEquals(Array.from(imports.keys()), ['..']);
  const map = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(map.keys()), ['css', 'id']);
  t.assertArrayEquals(Array.from(map.values())[0], ['slider', 'oven', 'mitten']);
  t.assertArrayEquals(Array.from(map.values())[1], ['dog', 'cat']);
});

t.test('namespecMultipleImports', () => {
  const spec = `
namespace slider

from .. import
  css
    dog
    cat
    bark
  id
    yes
from /slider import
  css
    slider
`;
  const parser = new NamespecParser(spec);
  const {namespace, imports} = parser.parse();

  t.assertEquals(namespace, 'slider');
  t.assertArrayEquals(Array.from(imports.keys()), ['..', '/slider']);
  const parentMap = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(parentMap.keys()), ['css', 'id']);
  t.assertArrayEquals(Array.from(parentMap.values())[0], ['dog', 'cat', 'bark']);
  t.assertArrayEquals(Array.from(parentMap.values())[1], ['yes']);

  const sliderMap = imports.get('/slider') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(sliderMap.keys()), ['css']);
  t.assertArrayEquals(Array.from(sliderMap.values())[0], ['slider']);
});

t.test('namespecNoTrailingWhitespace', () => {
  const spec = `
namespace slider

reserve
  css
    cat

from .. import
  css
    slider`;
  const parser = new NamespecParser(spec);
  const {namespace, imports, reserves} = parser.parse();

  t.assertEquals(namespace, 'slider');

  t.assertArrayEquals(Array.from(reserves.keys()), ['css']);
  t.assertArrayEquals(Array.from(Array.from(reserves.values())[0].values()), ['cat']);

  t.assertArrayEquals(Array.from(imports.keys()), ['..']);
  const map = imports.get('..') as Map<string, string[]>;
  t.assertArrayEquals(Array.from(map.keys()), ['css']);
  t.assertArrayEquals(Array.from(map.values())[0], ['slider']);
});

t.test('simpleIncrementerBasic', () => {
  const r = new Renamer(SimpleIncrementer, ['cls', 'id']);
  t.assertEquals(r.addName('cls', 'dog'), 'dog');
  t.assertEquals(r.addName('id', 'dog'), 'dog');

  // Adding name again just reuses old name.
  t.assertEquals(r.addName('cls', 'dog'), 'dog');
});

t.test('simpleIncrementerNamespace', () => {
  const r = new Renamer(SimpleIncrementer, ['cls']);
  t.assertEquals(r.addName('cls', 'dog'), 'dog');

  const module = r.namespace('module');
  t.assertEquals(module.addName('cls', 'dog'), 'dog_1');
});

t.test('moduleIncrementerNamespace', () => {
  const r = new Renamer(ModuleIncrementer, ['cls']);
  t.assertEquals(r.addName('cls', 'dog'), 'dog');

  const module = r.namespace('module');
  t.assertEquals(module.addName('cls', 'dog'), 'module_dog');

  const badModule = r.namespace('mod^ule');
  t.assertEquals(badModule.addName('cls', 'dog'), 'module_dog_1');
});

t.test('importWarning', () => {
  const r = new Renamer(MinimalIncrementer, ['cls']);
  r.import('module', 'cls', 'dog');

  const danglers = r.danglingImports();
  t.assertEquals(danglers.length, 1);
  t.assertObjectEquals(danglers[0], {
    sourceNamespace: 'root',
    importNamespace: 'root/module',
    type: 'cls',
    name: 'dog',
  });
});

t.test('importOkModuleToParent', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  t.assertEquals(r.addName('id', 'dog'), 'a');

  const component = r.namespace('component');
  component.import('..', 'id', 'dog');

  // No dangling imports.
  t.assertEquals(r.danglingImports().length, 0);
});

t.test('importWarningParentToModule', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  // Import before module even exists.
  r.import('component', 'id', 'dog');

  r.addName('id', 'dog');

  r.namespace('component');

  // Don't add id dog from component...

  // Some dangling imports.
  const danglers = r.danglingImports();
  t.assertEquals(danglers.length, 1);
  t.assertObjectEquals(danglers[0], {
    sourceNamespace: 'root',
    importNamespace: 'root/component',
    type: 'id',
    name: 'dog',
  });
});

t.test('importOkParentToModule', () => {
  const r = new Renamer(MinimalIncrementer, ['id']);
  // Import before module even exists.
  r.import('component', 'id', 'dog');

  r.addName('id', 'dog');

  const component = r.namespace('component');
  component.addName('id', 'dog');

  // No dangling imports.
  t.assertEquals(r.danglingImports().length, 0);
});

t.test('danglingImportsRecursive', () => {
  const root = new Renamer(MinimalIncrementer, ['id']);
  const r = root.namespace('root2');
  // Import before module even exists.
  r.import('component', 'id', 'dog');

  r.addName('id', 'dog');

  // const component = r.namespace('component');

  // Don't add id dog from component...

  // Some dangling imports.
  t.assertEquals(root.danglingImports().length, 1);
});

t.test('reservedIncrementer', () => {
  const m = new MinimalIncrementer();
  m.reserve('b');
  t.assertEquals(m.next(), 'a');
  t.assertEquals(m.next(), 'c');
});

t.test('reservedRenamerChild', () => {
  const r = new Renamer(SimpleIncrementer, ['id']);
  const component = r.namespace('component');
  component.reserve('id', 'dog');

  const dog = r.addName('id', 'dog');
  t.assertEquals(dog, 'dog_1');
});

t.test('reservedRenamerParent', () => {
  const r = new Renamer(SimpleIncrementer, ['id']);
  const component = r.namespace('component');
  r.reserve('id', 'dog');

  const dog = component.addName('id', 'dog');
  t.assertEquals(dog, 'dog_1');
});

t.test('virtualFsBasic', () => {
  const fs = new VirtualFs();
  fs.writeFileSync('/hello.txt', 'hello world');
  t.assertEquals(fs.readFileSync('/hello.txt').toString(), 'hello world');
  t.assertArrayEquals(fs.readdirSync('/'), ['hello.txt']);
});

t.test('virtualFsListDir', () => {
  const fs = new VirtualFs();
  fs.writeFileSync('/src/index.html', '');
  fs.writeFileSync('/src/style.css', '');
  fs.writeFileSync('/src/component/component.html', '');
  fs.writeFileSync('/src/component/component.css', '');
  fs.writeFileSync('/src/component/toggle/toggle.css', '');
  fs.writeFileSync('/src/component/toggle/tests/style/test.js', '');
  fs.writeFileSync('/out/module/component/test.txt', '');

  t.assertArrayEquals(fs.readdirSync('/'), ['out/', 'src/']);
  t.assertArrayEquals(fs.readdirSync('/src/'), [
    'component/',
    'index.html',
    'style.css',
  ]);
  t.assertArrayEquals(fs.readdirSync('/src/component/'), [
    'component.css',
    'component.html',
    'toggle/',
  ]);
  t.assertArrayEquals(fs.readdirSync('/src/component/toggle/'), [
    'tests/',
    'toggle.css',
  ]);
  t.assertArrayEquals(fs.readdirSync('/src/component/toggle/tests/'), ['style/']);
  t.assertArrayEquals(fs.readdirSync('/src/component/toggle/tests/style/'), [
    'test.js',
  ]);
  t.assertArrayEquals(fs.readdirSync('/out/'), ['module/']);
  t.assertArrayEquals(fs.readdirSync('/out/module/'), ['component/']);
  t.assertArrayEquals(fs.readdirSync('/out/module/component/'), ['test.txt']);
});

t.test('distinguisherBasic', () => {
  const fs = new VirtualFs();
  fs.writeFileSync('/src/style.css', '._cls-content { color: gray; }');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertArrayEquals(fs.readdirSync('/'), ['out/', 'src/']);
  t.assertArrayEquals(fs.readdirSync('/out/'), ['style.css']);

  t.assertEquals(fs.readFileSync('/out/style.css').toString(), '.a { color: gray; }');
});

t.test('distinguisherClsAndIdBasic', () => {
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/index.html',
    '<div id="_id-content" class="_cls-content">Content here</div>'
  );
  fs.writeFileSync(
    '/src/component/style.css',
    `
    ._cls-content {
      color: gray;
    }
    #_id-content {
      font-weight: bold;
    }`
  );

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(
    fs.readFileSync('/out/index.html').toString(),
    '<div id="a" class="a">Content here</div>'
  );

  t.assertEquals(
    fs.readFileSync('/out/component/style.css').toString(),
    `
    .a {
      color: gray;
    }
    #a {
      font-weight: bold;
    }`
  );
});

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

function toggleTest(
  initialClass: string,
  indexClass: string,
  cssClass: string,
  jsClass: string,
  playWithFiles?: (fs: VirtualFs) => void
) {
  const fs = new VirtualFs();
  fs.writeFileSync('/src/index.html', toggleSrcIndex(initialClass));
  fs.writeFileSync('/src/toggle/toggle.css', toggleToggleCss(initialClass));
  fs.writeFileSync('/src/toggle/toggle.js', toggleToggleJs(initialClass));

  if (playWithFiles != null) playWithFiles(fs);

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(
    fs.readFileSync('/out/index.html').toString(),
    toggleSrcIndex(indexClass)
  );
  t.assertEquals(
    fs.readFileSync('/out/toggle/toggle.css').toString(),
    toggleToggleCss(cssClass)
  );
  t.assertEquals(
    fs.readFileSync('/out/toggle/toggle.js').toString(),
    toggleToggleJs(jsClass)
  );
}

t.test('distinguisherNamespaceClash', () => {
  toggleTest('_cls-toggle', 'a', 'a', 'a');
});

t.test('distinguisherNamespaceFixComponent', () => {
  toggleTest('_cls-toggle', 'a', 'b', 'b', (fs: VirtualFs) => {
    fs.writeFileSync('/src/toggle/.namespec', 'namespace toggle');
  });
});

t.test('distinguisherNamespaceImport', () => {
  toggleTest('_cls-toggle', 'a', 'a', 'a', (fs: VirtualFs) => {
    fs.writeFileSync(
      '/src/toggle/.namespec',
      `namespace toggle

from .. import
  cls
    toggle`
    );
  });
});

t.test('distinguisherNamespecReserve', () => {
  toggleTest('_cls-toggle', 'b', 'c', 'c', (fs: VirtualFs) => {
    fs.writeFileSync(
      '/src/toggle/.namespec',
      `namespace toggle

reserve
  cls
    a`
    );
  });
});

t.test('distinguisherNamespecDeclareBasic', () => {
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/.namespec',
    `namespace main

declare
  var
    blue=#697f98`
  );
  fs.writeFileSync(
    '/src/style.css',
    `._cls-foreground {
  color: _var-blue;
}

._cls-background {
  background: _var-blue;
}`
  );
  fs.writeFileSync('/src/index.html', '<svg><rect fill="_var-blue"></rect></svg>');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id', 'var'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(
    fs.readFileSync('/out/style.css').toString(),
    `.a {
  color: #697f98;
}

.b {
  background: #697f98;
}`
  );
  t.assertEquals(
    fs.readFileSync('/out/index.html').toString(),
    '<svg><rect fill="#697f98"></rect></svg>'
  );
});

t.test('distinguisherNamespecDeclareModuleNoSpec', () => {
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/.namespec',
    `namespace main

declare
  var
    blue=#697f98`
  );
  fs.writeFileSync('/src/index.html', '<svg><rect fill="_var-blue"></rect></svg>');
  fs.writeFileSync('/src/toggle/toggle.html', '_var-blue');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id', 'var'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(fs.readFileSync('/out/toggle/toggle.html').toString(), '#697f98');
});

t.test('distinguisherNamespecDeclareModuleSpec', () => {
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/.namespec',
    `namespace main

declare
  var
    blue=#697f98`
  );
  fs.writeFileSync('/src/index.html', '<svg><rect fill="_var-blue"></rect></svg>');
  fs.writeFileSync('/src/toggle/.namespec', 'namespace toggle');
  fs.writeFileSync('/src/toggle/toggle.html', '_var-blue');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id', 'var'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(fs.readFileSync('/out/toggle/toggle.html').toString(), 'a');
});

t.test('distinguisherNamespecDeclareModuleSpecImportParent', () => {
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/.namespec',
    `namespace main

declare
  var
    blue=#697f98`
  );
  fs.writeFileSync('/src/index.html', '<svg><rect fill="_var-blue"></rect></svg>');
  fs.writeFileSync(
    '/src/toggle/.namespec',
    `namespace toggle

from .. import
  var
    blue`
  );
  fs.writeFileSync('/src/toggle/toggle.html', '_var-blue');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id', 'var'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(fs.readFileSync('/out/toggle/toggle.html').toString(), '#697f98');
});

t.test('distinguisherNamespecDeclareModuleSpecImportChild', () => {
  // Cannot import going the other way.
  const fs = new VirtualFs();
  fs.writeFileSync(
    '/src/.namespec',
    `namespace main

declare
  var
    blue=#697f98

from toggle import
  var
    blue`
  );
  fs.writeFileSync('/src/index.html', '<svg><rect fill="_var-blue"></rect></svg>');
  fs.writeFileSync('/src/toggle/toggle.html', '_var-blue');
  fs.writeFileSync('/src/toggle/.namespec', 'namespace toggle');

  const config: DistinguishConfig = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id', 'var'],
    exclude: [],
  };

  const d = new Distinguisher(config, fs, fs.dirname, false);
  d.run();

  t.assertEquals(fs.readFileSync('/out/toggle/toggle.html').toString(), 'a');
});

function cli(argsString: string, fsInit?: (fs: VirtualFs) => void): CLIResult {
  const fs = new VirtualFs();
  if (fsInit != null) fsInit(fs);
  return new CLI(
    null,
    argsString.split(' ').filter(x => x.trim().length > 0),
    fs,
    fs.require.bind(fs),
    fs.dirname,
    fs.join,
    () => '/',
    true
  ).process();
}

t.test('distinguishCliShowDialogs', () => {
  // Help
  t.assertObjectEquals(cli('--help'), {showUsage: 'base'});
  t.assertObjectEquals(cli('-h'), {showUsage: 'base'});
  t.assertObjectEquals(cli('--usage'), {showUsage: 'base'});
  t.assertObjectEquals(cli('help'), {showUsage: 'base'});
  t.assertObjectEquals(cli('help init'), {showUsage: 'init'});
  t.assertObjectEquals(cli('help rename'), {showUsage: 'rename'});
  t.assertObjectEquals(cli('--invalid-option'), {showUsage: 'base'});
  t.assertObjectEquals(cli('rename --invalid-option'), {showUsage: 'rename'});

  // Version
  t.assertObjectEquals(cli('-v'), {showVersion: true});
  t.assertObjectEquals(cli('--version'), {showVersion: true});

  // Splash
  t.assertObjectEquals(cli('--splash'), {showSplash: true});
});

t.test('distinguishCliInit', () => {
  t.assertObjectEquals(cli('init'), {initFn: 'distinguish.config.js'});
  t.assertObjectEquals(cli('init config.js'), {initFn: 'config.js'});
  t.assertObjectEquals(cli('init -o'), {showUsage: 'init'});
  t.assertObjectEquals(cli('init config.js extraneous'), {showUsage: 'init'});
});

t.test('distinguishCliRenameNoConfig', () => {
  const result = cli('rename');
  // File won't exist yet.
  t.assertEquals(result.showUsage, 'rename');
});

function getConfig(
  incrementer: string = 'simple',
  types: string[] = ['cls', 'id'],
  inputDir: string = 'src/',
  outputDir: string = 'out/',
  exclude: string[] = []
): string {
  return `exports.default = {
    incrementer: '${incrementer}', // the incrementer to use ([minimal, simple, module])
    types: ${JSON.stringify(types)}, // the types to rename (e.g. CSS classes, IDs)
  
    inputDir: '${inputDir}', // the input directory to use
    outputDir: '${outputDir}', // the output directory to use
  
    exclude: ${JSON.stringify(
      exclude
    )}, // a regular expression array describing files to exclude from renaming
  };
  `;
}

t.test('distinguishCliRenameWithConfig', () => {
  for (const cmd of [
    'rename ',
    'rename -c',
    'rename -c distinguish.config.js',
    'rename --config',
    'rename --config distinguish.config.js',
  ]) {
    const result = cli(cmd, fs => {
      fs.writeFileSync('distinguish.config.js', getConfig());
    });

    // Let's check we get a matching config.
    t.assert(result.opts);
    const opts = result.opts as RenameOptions;
    t.assertEquals(opts, {
      configFile: 'distinguish.config.js',
      incrementer: 'simple',
      types: ['cls', 'id'],
      inputDir: 'src/',
      outputDir: 'out/',
      exclude: [],
    });
  }
});

t.test('distinguishCliRenameWithConfigDifferentFile', () => {
  for (const cmd of [
    'rename -c specification/config.js',
    'rename --config specification/config.js',
  ]) {
    const result = cli(cmd, fs => {
      fs.writeFileSync('specification/config.js', getConfig());
    });

    // Let's check we get a matching config.
    t.assert(result.opts);
    const opts = result.opts as RenameOptions;
    t.assertEquals(opts, {
      configFile: 'specification/config.js',
      incrementer: 'simple',
      types: ['cls', 'id'],
      inputDir: 'src/',
      outputDir: 'out/',
      exclude: [],
    });
  }
});

t.test('distinguishCliRenameWithOverrides', () => {
  const result = cli(
    'rename -c spec/settings/config.js -n minimal -t dog,cat,hen -i input/src/ -o dest/ -e dog,cat',
    fs => {
      fs.writeFileSync('spec/settings/config.js', getConfig());
    }
  );

  // Let's check we get a matching config.
  t.assert(result.opts);
  const opts = result.opts as RenameOptions;
  t.assertEquals(opts, {
    configFile: 'spec/settings/config.js',
    incrementer: 'minimal',
    types: ['dog', 'cat', 'hen'],
    inputDir: 'input/src/',
    outputDir: 'dest/',
    exclude: [/dog/, /cat/],
  });
});

t.test('distinguishCliWatch', () => {
  const result = cli('rename -c spec/settings/config.js -w', fs => {
    fs.writeFileSync('spec/settings/config.js', getConfig());
  });

  // Let's check we get a matching config.
  t.assert(result.opts);
  const opts = result.opts as RenameOptions;
  t.assertEquals(opts, {
    configFile: 'spec/settings/config.js',
    incrementer: 'simple',
    types: ['cls', 'id'],
    inputDir: 'src/',
    outputDir: 'out/',
    exclude: [],
    watch: true,
  });
});
