import {Renamer} from './renamer';
import {Tester} from './tester';
import {NamespecParser} from './namespec';
import {MinimalIncrementer, SimpleIncrementer, ModuleIncrementer} from './incrementer';

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
