import {Renamer} from './renamer';

export abstract class Incrementer {
  abstract next(name?: string, renamer?: Renamer): string;
}

export class SimpleIncrementer extends Incrementer {
  private allNames = new Set();

  constructor() {
    super();
  }

  next(name: string): string {
    if (this.allNames.has(name)) {
      const baseName = name;

      // Start incrementing names.
      let i = 1;
      do {
        name = `${baseName}_${i}`;
      } while (this.allNames.has(name));
    }
    this.allNames.add(name);
    return name;
  }
}

function characterSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '');
}

export class ModuleIncrementer extends Incrementer {
  private allNames = new Set();

  constructor() {
    super();
  }

  next(name: string, renamer: Renamer): string {
    name = `${characterSafe(renamer.namespaces.slice(1).join('_'))}${
      renamer.namespaces.length > 1 ? '_' : ''
    }${name}`;

    if (this.allNames.has(name)) {
      const baseName = name;

      // Start incrementing names.
      let i = 1;
      do {
        name = `${baseName}_${i}`;
      } while (this.allNames.has(name));
    }
    this.allNames.add(name);
    return name;
  }
}

export class MinimalIncrementer extends Incrementer {
  private length: number = 1; // current length of variable names being iterated.
  private index: number = 0; // an internal index to help iterate without storing names
  public allowedFirstCharacters: string;

  /**
   *
   * @param allowedCharacters A string containing all the allowed characters in variable names.
   * @param allowedFirstCharacters An optional string containing all the allowed characters at the start of variable names. If set, variable names will only start with characters in this string.
   */
  constructor(
    readonly allowedCharacters: string = 'abcdefghijklmnopqrstuvwxyz0123456789',
    allowedFirstCharacters: string = 'abcdefghijklmnopqrstuvwxyz'
  ) {
    super();
    this.allowedFirstCharacters =
      allowedFirstCharacters == null ? allowedCharacters : allowedFirstCharacters;
  }

  next(): string {
    // Use the current index and calculate all the positions in the allowed
    // character arrays by dividing and calculating the modulus at appropriate
    // strides.
    let i = this.index;
    // Store whether the current iteration is the last iteration at the current
    // length.
    let last = true;

    // Build the resulting string backwards by iterating and applying modulus
    // methods.
    let result = '';
    // Iterate through the allowed characters at any position in the string.
    for (let _ = 0; _ < this.length - 1; _++) {
      const index = i % this.allowedCharacters.length;
      if (index != this.allowedCharacters.length - 1) last = false;
      result = this.allowedCharacters.charAt(index) + result;
      // Integer divide i by the length of the allowed characters.
      i = (i / this.allowedCharacters.length) | 0;
    }
    // Finally, place the proper character from the allowed first characters at
    // the beginning of the resulting string.
    if (i != this.allowedFirstCharacters.length - 1) last = false;
    result = this.allowedFirstCharacters.charAt(i) + result;

    if (last) {
      // If the current iteration is the last one at the current length,
      // increment the length and reset the index.
      this.index = 0;
      this.length++;
    } else {
      // Otherwise, simply increment the index.
      this.index++;
    }
    return result;
  }
}
