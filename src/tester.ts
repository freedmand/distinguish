const PASS = ['32']; // green
const FAIL = ['31', '1']; // red, bold

function logStyle(ansiEscapeCodes: string[], text: string) {
  console.log(`\x1b[${ansiEscapeCodes.join(';')}m${text}\x1b[0m`);
}

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

  assertEquals(arg1: any, arg2: any) {
    if (arg1 != arg2) throw new Error(`Expected ${arg1} to equal ${arg2}`);
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
