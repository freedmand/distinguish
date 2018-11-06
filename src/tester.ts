import {logStyle, PASS, FAIL} from './log';

function getKeys(object: any): string[] {
  const results = [];
  for (const property in object) {
    if (object.hasOwnProperty(property)) results.push(property);
  }
  return results.sort();
}

function getValues(object: any): string[] {
  return getKeys(object).map(k => object[k]);
}

export class Tester {
  constructor() {}

  test(name: string, fn: () => void) {
    try {
      fn.bind(this)();
      logStyle(PASS, `${name} PASSED`);
    } catch (e) {
      logStyle(
        FAIL,
        `${name} FAILED:
  ${e}`
      );
      process.on('exit', () => (process.exitCode = 1));
    }
  }

  static getType(obj: any): 'array' | 'object' | 're' | 'primitive' {
    if (Array.isArray(obj)) {
      return 'array';
    } else if (obj instanceof RegExp) {
      return 're';
    } else if (obj.constructor == Object) {
      return 'object';
    } else {
      return 'primitive';
    }
  }

  assertEquals(arg1: any, arg2: any) {
    const type1 = Tester.getType(arg1);
    const type2 = Tester.getType(arg2);
    if (type1 != type2) {
      throw new Error(
        `Types of ${arg1} and ${arg2} are not the same: ${type1} vs. ${type2}`
      );
    }
    if (type1 == 'array') {
      this.assertArrayEquals(arg1, arg2);
    } else if (type1 == 'object') {
      this.assertObjectEquals(arg1, arg2);
    } else if (type1 == 're') {
      this.assertEquals(arg1.source, arg2.source);
    } else {
      if (arg1 != arg2) throw new Error(`Expected ${arg1} to equal ${arg2}`);
    }
  }

  assertArrayEquals(arg1: Array<any>, arg2: Array<any>) {
    if (arg1.length != arg2.length) {
      throw new Error(
        `${arg1} and ${arg2} have differing lengths (${arg1.length} vs. ${arg2.length})`
      );
    }
    for (let i = 0; i < arg1.length; i++) {
      this.assertEquals(arg1[i], arg2[i]);
    }
  }

  assertObjectEquals(arg1: any, arg2: any) {
    const properties1 = getKeys(arg1);
    const properties2 = getKeys(arg2);
    this.assertArrayEquals(properties1, properties2);

    const values1 = getValues(arg1);
    const values2 = getValues(arg2);
    this.assertArrayEquals(values1, values2);
  }

  assert(condition: any) {
    if (!condition) throw new Error(`Expected ${condition} to be truthy`);
  }
}
