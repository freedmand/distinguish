'use strict';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

















function __values(o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

/**
 * Returns the directory name for a file. Do not depend on fs so we can play with this
 * library in the browser.
 * @param fn The file name
 */
function getDir(fn) {
    var addSlashLater = false;
    if (fn.endsWith('/')) {
        fn = fn.substr(0, fn.length - 1);
        addSlashLater = true;
    }
    var parts = fn.split('/');
    return {
        directory: parts.slice(0, parts.length - 1).join('/') + '/',
        tail: parts[parts.length - 1] + (addSlashLater ? '/' : '')
    };
}
var VirtualFs = /** @class */ (function () {
    function VirtualFs() {
        this.directories = new Map();
        this.fileMap = new Map();
    }
    VirtualFs.prototype.dirname = function (path) {
        return getDir(path).directory;
    };
    VirtualFs.prototype.join = function () {
        var parts = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            parts[_i] = arguments[_i];
        }
        var trailingSlash = parts[parts.length - 1].endsWith('/');
        return (parts.map(function (x) { return (x.endsWith('/') ? x.substr(0, x.length - 1) : x); }).join('/') +
            (trailingSlash ? '/' : ''));
    };
    VirtualFs.prototype.require = function (path) {
        var contents = this.readFileSync(path).toString();
        var sandbox = {};
        var wrappedCode = "\n      void function(exports) {\n        " + contents + "\n      }(sandbox)";
        eval(wrappedCode);
        return sandbox;
    };
    VirtualFs.prototype.setDirectory = function (fnOrDir) {
        // Base case.
        if (fnOrDir == '/')
            return;
        // Create directories recursively.
        this.mkdirSync(fnOrDir);
    };
    VirtualFs.prototype.statSync = function (fn) {
        // Pretty naive directory checking.
        if (fn.endsWith('/')) {
            return {
                isDirectory: function () {
                    return true;
                }
            };
        }
        return {
            isDirectory: function () {
                return false;
            }
        };
    };
    VirtualFs.prototype.mkdirSync = function (dir) {
        var _a = getDir(dir), parentDir = _a.directory, tail = _a.tail;
        var directorySet = this.directories.get(parentDir);
        if (directorySet != null) {
            directorySet.add(tail);
        }
        else {
            this.directories.set(parentDir, new Set([tail]));
        }
        this.setDirectory(parentDir);
    };
    VirtualFs.prototype.writeFileSync = function (fn, contents) {
        this.fileMap.set(fn, contents);
        this.setDirectory(fn);
    };
    VirtualFs.prototype.existsSync = function (fn) {
        if (!fn.endsWith('/')) {
            // File existence check.
            return this.fileMap.has(fn);
        }
        else {
            if (fn == '/')
                return true; // root always exists.
            // Check directory existence.
            var _a = getDir(fn), parentDir = _a.directory, tail = _a.tail;
            var directorySet = this.directories.get(parentDir);
            if (directorySet != null)
                return directorySet.has(tail);
            return false;
        }
    };
    VirtualFs.prototype.readFileSync = function (fn) {
        var contents = this.fileMap.get(fn);
        return {
            toString: function () {
                return contents;
            }
        };
    };
    VirtualFs.prototype.readdirSync = function (dir) {
        if (!dir.endsWith('/'))
            dir += '/';
        var directorySet = this.directories.get(dir);
        if (directorySet == null)
            return [];
        return Array.from(directorySet.values()).sort();
    };
    return VirtualFs;
}());

var Renamer = /** @class */ (function () {
    function Renamer(incrementerType, types, namespaces, parent) {
        var e_1, _a;
        if (namespaces === void 0) { namespaces = ['root']; }
        this.incrementerType = incrementerType;
        this.types = types;
        this.namespaces = namespaces;
        this.parent = parent;
        this.childNamespaces = [];
        this.namingMaps = new Map();
        this.ownNamingMaps = new Map();
        this.childNamespaceMap = new Map();
        this.incrementers = new Map();
        this.imports = new Map();
        try {
            for (var types_1 = __values(types), types_1_1 = types_1.next(); !types_1_1.done; types_1_1 = types_1.next()) {
                var type = types_1_1.value;
                this.namingMaps.set(type, new Map());
                this.ownNamingMaps.set(type, new Map());
                this.incrementers.set(type, new incrementerType());
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (types_1_1 && !types_1_1.done && (_a = types_1["return"])) _a.call(types_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    Renamer.prototype.fullNamespace = function () {
        return this.namespaces.join('/');
    };
    /**
     * Creates a namespace specified by a single string, or returns the one if it already
     * exists.
     * @param name The namespace or its parts.
     */
    Renamer.prototype.namespace = function (name) {
        if (Array.isArray(name)) {
            if (name.length == 0)
                return this;
            return this.namespace(name[0]).namespace(name.slice(1));
        }
        if (name == '..') {
            var parent = this.parent;
            if (parent == null)
                throw new Error('Cannot backtrack from root');
            return parent;
        }
        if (name == '/') {
            return this.getRoot();
        }
        if (this.childNamespaceMap.has(name)) {
            return this.childNamespaceMap.get(name);
        }
        var renamer = new Renamer(this.incrementerType, this.types, this.namespaces.concat([name]), this);
        this.childNamespaces.push(renamer);
        this.childNamespaceMap.set(name, renamer);
        return renamer;
    };
    Renamer.pathSpecToParts = function (spec) {
        var parts = [];
        if (spec.startsWith('/')) {
            parts.push('/');
            spec = spec.substr(1);
        }
        if (spec.length > 0) {
            parts = parts.concat(spec.split('/'));
        }
        return parts;
    };
    Renamer.prototype.getRoot = function () {
        if (this.parent)
            return this.parent.getRoot();
        return this;
    };
    Renamer.prototype.increment = function (type, value, originalCaller) {
        if (originalCaller === void 0) { originalCaller = this; }
        if (this.parent != null)
            return this.parent.increment(type, value, originalCaller);
        var incrementer = this.incrementers.get(type);
        if (incrementer == null)
            throw new Error('Invalid type');
        return incrementer.next(value, originalCaller);
    };
    Renamer.prototype.addName = function (type, value, originalCaller) {
        if (originalCaller === void 0) { originalCaller = this; }
        var typeMap = this.namingMaps.get(type);
        var ownTypeMap = this.ownNamingMaps.get(type);
        var importMap = this.imports.get(type);
        var incrementer = this.incrementers.get(type);
        if (typeMap == null || incrementer == null)
            throw new Error('Invalid type');
        if (importMap != null) {
            if (importMap.has(value)) {
                var name_1 = importMap.get(value).addName(type, value, this);
                if (originalCaller == this) {
                    // Add to own type map if applicable.
                    ownTypeMap.set(value, name_1);
                }
                return name_1;
            }
        }
        if (typeMap.has(value)) {
            // Return early if the name is found.
            var name_2 = typeMap.get(value);
            if (originalCaller == this) {
                // Add to own type map if applicable.
                ownTypeMap.set(value, name_2);
            }
            return name_2;
        }
        var name = this.increment(type, value, originalCaller);
        typeMap.set(value, name);
        if (originalCaller == this) {
            // Add to own type map if applicable.
            ownTypeMap.set(value, name);
        }
        return name;
    };
    Renamer.prototype.setImport = function (type, name, renamer) {
        var importMap;
        if (this.imports.has(type)) {
            importMap = this.imports.get(type);
        }
        else {
            importMap = new Map();
            this.imports.set(type, importMap);
        }
        importMap.set(name, renamer);
    };
    Renamer.prototype["import"] = function (namespaceSpec, type, name) {
        var parts = Renamer.pathSpecToParts(namespaceSpec);
        var namespace = this.namespace(parts);
        this.setImport(type, name, namespace);
    };
    Renamer.prototype.reserve = function (type, name) {
        if (this.parent != null)
            this.parent.reserve(type, name);
        var incrementer = this.incrementers.get(type);
        if (incrementer == null)
            throw new Error("Cannot reserve: invalid type " + type);
        incrementer.reserve(name);
    };
    Renamer.prototype.danglingImports = function () {
        var e_2, _a, e_3, _b, e_4, _c;
        var danglers = [];
        try {
            for (var _d = __values(this.imports.entries()), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = __read(_e.value, 2), type = _f[0], importMap = _f[1];
                try {
                    // Go through each type-to-import entry.
                    for (var _g = __values(importMap.entries()), _h = _g.next(); !_h.done; _h = _g.next()) {
                        var _j = __read(_h.value, 2), name = _j[0], renamer = _j[1];
                        // Grab the import renamer instance, and use that to extract the typemap.
                        var typeMap = renamer.ownNamingMaps.get(type);
                        if (typeMap == null || !typeMap.has(name)) {
                            // The import is unused.
                            danglers.push({
                                sourceNamespace: this.fullNamespace(),
                                importNamespace: renamer.fullNamespace(),
                                type: type,
                                name: name
                            });
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_h && !_h.done && (_b = _g["return"])) _b.call(_g);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d["return"])) _a.call(_d);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            // Recurse
            for (var _k = __values(this.childNamespaces), _l = _k.next(); !_l.done; _l = _k.next()) {
                var child = _l.value;
                danglers = danglers.concat(child.danglingImports());
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_l && !_l.done && (_c = _k["return"])) _c.call(_k);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return danglers;
    };
    return Renamer;
}());

/**
 * Parse files with contents like this:
 *
 *   namespace: component
 *
 *   from .. import
 *     css
 *       dog
 *       cat
 *       bark
 *     id
 *       yes
 *
 *   from /slider import
 *     css
 *       slider
 */
var NamespecParser = /** @class */ (function () {
    function NamespecParser(specContents) {
        this.specContents = specContents;
    }
    NamespecParser.prototype.getLine = function () {
        if (this.specContents.length == 0)
            return { eof: true, length: 0 };
        var position = this.specContents.indexOf('\n');
        if (position == -1) {
            return { contents: this.specContents, length: this.specContents.length };
        }
        return { contents: this.specContents.substr(0, position), length: position + 1 };
    };
    NamespecParser.prototype.eof = function () {
        return this.specContents.length == 0;
    };
    NamespecParser.prototype.advance = function (n) {
        this.specContents = this.specContents.substr(n);
    };
    NamespecParser.prototype.consumeWhitespaceWhileExists = function () {
        while (true) {
            var line = this.getLine();
            if (line.contents == null)
                return;
            if (line.contents.match(/^\s*$/)) {
                this.advance(line.length);
            }
            else {
                break;
            }
        }
    };
    NamespecParser.prototype.consumeLine = function (spec, flag) {
        this.consumeWhitespaceWhileExists();
        var line = this.getLine();
        var length = line.length;
        // If at the end of file, return accordingly.
        if (line.eof != null)
            return { eof: true, length: length };
        var contents = line.contents;
        // Try to match the line.
        var match = contents.match(spec);
        // Return early if there is no match.
        if (match == null)
            return { match: false, length: length };
        // Return matching group one otherwise.
        this.advance(length);
        var result = { contents: match[1], allMatches: match, length: length };
        if (flag != null)
            result.flag = flag;
        return result;
    };
    NamespecParser.prototype.consumeNamespace = function () {
        var namespace = this.consumeLine(/^namespace (.+)$/);
        if (namespace.contents == null) {
            throw new Error('Expected to consume namespace');
        }
        return namespace.contents;
    };
    NamespecParser.prototype.consumeImportOrReserve = function () {
        var result = this.consumeLine(/^from ([^ ]+) import$/, 'import');
        if (result.contents == null) {
            result = this.consumeLine(/^(reserve)$/, 'reserve');
        }
        return result;
    };
    NamespecParser.prototype.consumeIndented = function (expectedWhitespace) {
        var type;
        if (expectedWhitespace == null) {
            type = this.consumeLine(/^([ \t]+)([a-zA-Z0-9_-]+)$/);
        }
        else {
            type = this.consumeLine(new RegExp("^(" + expectedWhitespace + ")([a-zA-Z0-9_-]+)$"));
        }
        if (type.allMatches == null)
            return null;
        return {
            value: type.allMatches[2],
            whitespace: type.allMatches[1]
        };
    };
    NamespecParser.prototype.parse = function () {
        var namespace = this.consumeNamespace();
        var expectedTypeWhitespace = null;
        var expectedNameWhitespace = null;
        var imports = new Map();
        var reserves = new Map();
        var result = { namespace: namespace, imports: imports, reserves: reserves };
        while (true) {
            // Iterate through remaining file consuming import statements.
            var entryResult = this.consumeImportOrReserve();
            if (entryResult.contents == null) {
                // If at end-of-file, successful parse!
                this.consumeWhitespaceWhileExists();
                if (this.eof())
                    return result;
                // Throw consume error otherwise.
                throw new Error("Unexpected contents: " + this.specContents.substr(0, 15) + (this.specContents.length > 15 ? '...' : ''));
            }
            var importMap = null;
            if (entryResult.flag == 'import') {
                var importNamespace = entryResult.contents;
                if (!result.imports.has(importNamespace)) {
                    // Create the import map.
                    importMap = new Map();
                    result.imports.set(importNamespace, importMap);
                }
                else {
                    importMap = result.imports.get(importNamespace);
                }
            }
            else if (entryResult.flag != 'reserve') {
                throw new Error("Unexpected flag: " + entryResult.flag);
            }
            while (true) {
                // Iterate through import consuming top-level types.
                var type = this.consumeIndented(expectedTypeWhitespace);
                if (type == null)
                    break;
                var typeValue = type.value;
                expectedTypeWhitespace = type.whitespace;
                while (true) {
                    // Iterate through type consuming secondary-level names.
                    var name = void 0;
                    if (expectedNameWhitespace == null) {
                        // If name indent level is unknown, search for more indented than type.
                        name = this.consumeIndented(expectedTypeWhitespace + '[ \t]+');
                    }
                    else {
                        name = this.consumeIndented(expectedNameWhitespace);
                    }
                    if (name == null)
                        break;
                    var nameValue = name.value;
                    expectedNameWhitespace = name.whitespace;
                    // Add in the type, name pair.
                    if (importMap != null) {
                        // Add import
                        if (importMap.has(typeValue)) {
                            var nameEntries = importMap.get(typeValue);
                            nameEntries.push(nameValue);
                        }
                        else {
                            importMap.set(typeValue, [nameValue]);
                        }
                    }
                    else if (reserves != null) {
                        // Add reserved.
                        if (reserves.has(typeValue)) {
                            var reservedSet = reserves.get(typeValue);
                            reservedSet.add(nameValue);
                        }
                        else {
                            reserves.set(typeValue, new Set([nameValue]));
                        }
                    }
                    else {
                        throw new Error('Expected import or reserved map to be set');
                    }
                }
            }
        }
    };
    return NamespecParser;
}());

var Incrementer = /** @class */ (function () {
    function Incrementer() {
        this.reserved = new Set();
    }
    Incrementer.prototype.next = function (name, renamer) {
        var renamed;
        do {
            renamed = this.next_(name, renamer);
        } while (this.reserved.has(renamed));
        return renamed;
    };
    Incrementer.prototype.reserve = function (name) {
        this.reserved.add(name);
    };
    return Incrementer;
}());
var SimpleIncrementer = /** @class */ (function (_super) {
    __extends(SimpleIncrementer, _super);
    function SimpleIncrementer() {
        var _this = _super.call(this) || this;
        _this.allNames = new Set();
        return _this;
    }
    SimpleIncrementer.prototype.next_ = function (name) {
        if (this.allNames.has(name)) {
            var baseName = name;
            // Start incrementing names.
            var i = 1;
            do {
                name = baseName + "_" + i;
            } while (this.allNames.has(name));
        }
        this.allNames.add(name);
        return name;
    };
    return SimpleIncrementer;
}(Incrementer));
function characterSafe(s) {
    return s.replace(/[^a-zA-Z0-9]/g, '');
}
var ModuleIncrementer = /** @class */ (function (_super) {
    __extends(ModuleIncrementer, _super);
    function ModuleIncrementer() {
        var _this = _super.call(this) || this;
        _this.allNames = new Set();
        return _this;
    }
    ModuleIncrementer.prototype.next_ = function (name, renamer) {
        name = "" + characterSafe(renamer.namespaces.slice(1).join('_')) + (renamer.namespaces.length > 1 ? '_' : '') + name;
        if (this.allNames.has(name)) {
            var baseName = name;
            // Start incrementing names.
            var i = 1;
            do {
                name = baseName + "_" + i;
            } while (this.allNames.has(name));
        }
        this.allNames.add(name);
        return name;
    };
    return ModuleIncrementer;
}(Incrementer));
var MinimalIncrementer = /** @class */ (function (_super) {
    __extends(MinimalIncrementer, _super);
    /**
     *
     * @param allowedCharacters A string containing all the allowed characters in variable names.
     * @param allowedFirstCharacters An optional string containing all the allowed characters at the start of variable names. If set, variable names will only start with characters in this string.
     */
    function MinimalIncrementer(allowedCharacters, allowedFirstCharacters) {
        if (allowedCharacters === void 0) { allowedCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789'; }
        if (allowedFirstCharacters === void 0) { allowedFirstCharacters = 'abcdefghijklmnopqrstuvwxyz'; }
        var _this = _super.call(this) || this;
        _this.allowedCharacters = allowedCharacters;
        _this.length = 1; // current length of variable names being iterated.
        _this.index = 0; // an internal index to help iterate without storing names
        _this.allowedFirstCharacters =
            allowedFirstCharacters == null ? allowedCharacters : allowedFirstCharacters;
        return _this;
    }
    MinimalIncrementer.prototype.next_ = function () {
        // Use the current index and calculate all the positions in the allowed
        // character arrays by dividing and calculating the modulus at appropriate
        // strides.
        var i = this.index;
        // Store whether the current iteration is the last iteration at the current
        // length.
        var last = true;
        // Build the resulting string backwards by iterating and applying modulus
        // methods.
        var result = '';
        // Iterate through the allowed characters at any position in the string.
        for (var _ = 0; _ < this.length - 1; _++) {
            var index = i % this.allowedCharacters.length;
            if (index != this.allowedCharacters.length - 1)
                last = false;
            result = this.allowedCharacters.charAt(index) + result;
            // Integer divide i by the length of the allowed characters.
            i = (i / this.allowedCharacters.length) | 0;
        }
        // Finally, place the proper character from the allowed first characters at
        // the beginning of the resulting string.
        if (i != this.allowedFirstCharacters.length - 1)
            last = false;
        result = this.allowedFirstCharacters.charAt(i) + result;
        if (last) {
            // If the current iteration is the last one at the current length,
            // increment the length and reset the index.
            this.index = 0;
            this.length++;
        }
        else {
            // Otherwise, simply increment the index.
            this.index++;
        }
        return result;
    };
    return MinimalIncrementer;
}(Incrementer));

// green
 // green, bold
 // red, bold
var STATUS = ['37']; // gray
var WARN = ['95']; // magenta
var BOLD = ['1']; // bold
function logStyle(ansiEscapeCodes, text) {
    console.log("\u001B[" + ansiEscapeCodes.join(';') + "m" + text + "\u001B[0m");
}

var NAMESPEC = '.namespec';
// Adapted from https://stackoverflow.com/a/34509653
function ensureDirectoryExistence(filePath, dirnameFn, fs) {
    var dirname = dirnameFn(filePath);
    if (fs.existsSync(dirname))
        return;
    ensureDirectoryExistence(dirname, dirnameFn, fs);
    fs.mkdirSync(dirname);
}
function getAllMatches(regex, str) {
    var result;
    var results = [];
    while ((result = regex.exec(str)) !== null) {
        results.push(result);
    }
    return results;
}
var incrementers = {
    minimal: MinimalIncrementer,
    simple: SimpleIncrementer,
    module: ModuleIncrementer
};
var Distinguisher = /** @class */ (function () {
    function Distinguisher(distinguishConfig, fs, dirnameFn) {
        this.distinguishConfig = distinguishConfig;
        this.fs = fs;
        this.dirnameFn = dirnameFn;
        var incrementer = incrementers[distinguishConfig.incrementer];
        this.rootRenamer = new Renamer(incrementer, distinguishConfig.types);
    }
    Distinguisher.prototype.walkSync = function (dir, outDir, renamer, filelist) {
        var _this = this;
        if (dir === void 0) { dir = ''; }
        if (outDir === void 0) { outDir = ''; }
        if (filelist === void 0) { filelist = []; }
        var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e;
        if (!dir.endsWith('/'))
            dir += '/';
        if (!outDir.endsWith('/'))
            outDir += '/';
        var namespecPath = "" + dir + NAMESPEC;
        if (this.fs.existsSync(namespecPath)) {
            // Parse a namespec file to determine the renamer's new scope.
            var namespec = new NamespecParser(this.fs.readFileSync(namespecPath).toString()).parse();
            // Set the namespace.
            renamer = renamer.namespace(Renamer.pathSpecToParts(namespec.namespace));
            try {
                // Set imports.
                for (var _f = __values(namespec.imports.entries()), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var _h = __read(_g.value, 2), importName = _h[0], importMap = _h[1];
                    try {
                        for (var _j = __values(importMap.entries()), _k = _j.next(); !_k.done; _k = _j.next()) {
                            var _l = __read(_k.value, 2), type = _l[0], names = _l[1];
                            try {
                                for (var names_1 = __values(names), names_1_1 = names_1.next(); !names_1_1.done; names_1_1 = names_1.next()) {
                                    var name = names_1_1.value;
                                    renamer["import"](importName, type, name);
                                }
                            }
                            catch (e_3_1) { e_3 = { error: e_3_1 }; }
                            finally {
                                try {
                                    if (names_1_1 && !names_1_1.done && (_c = names_1["return"])) _c.call(names_1);
                                }
                                finally { if (e_3) throw e_3.error; }
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_k && !_k.done && (_b = _j["return"])) _b.call(_j);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_a = _f["return"])) _a.call(_f);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                // Set reserves.
                for (var _m = __values(namespec.reserves.entries()), _o = _m.next(); !_o.done; _o = _m.next()) {
                    var _p = __read(_o.value, 2), type = _p[0], reserves = _p[1];
                    try {
                        for (var _q = __values(reserves.values()), _r = _q.next(); !_r.done; _r = _q.next()) {
                            var reserveName = _r.value;
                            renamer.reserve(type, reserveName);
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_r && !_r.done && (_e = _q["return"])) _e.call(_q);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_o && !_o.done && (_d = _m["return"])) _d.call(_m);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }
        var files = this.fs.readdirSync(dir == '' ? '.' : dir);
        files.forEach(function (file) {
            var e_6, _a;
            var fn = "" + dir + file;
            try {
                for (var _b = __values(_this.distinguishConfig.exclude), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var exclude = _c.value;
                    if (fn.match(exclude) != null)
                        continue;
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
                }
                finally { if (e_6) throw e_6.error; }
            }
            if (_this.fs.statSync(fn).isDirectory()) {
                filelist = _this.walkSync("" + (fn + (fn.endsWith('/') ? '' : '/')), "" + outDir + file, renamer, filelist);
            }
            else {
                filelist.push({
                    inputFile: "" + dir + file,
                    outputFile: "" + outDir + file,
                    renamer: renamer
                });
            }
        });
        return filelist;
    };
    Distinguisher.prototype.run = function () {
        var e_7, _a, e_8, _b, e_9, _c;
        var startTime = Date.now();
        try {
            for (var _d = __values(this.walkSync(this.distinguishConfig.inputDir, this.distinguishConfig.outputDir, this.rootRenamer)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = _e.value, inputFile = _f.inputFile, outputFile = _f.outputFile, renamer = _f.renamer;
                var contents = this.fs.readFileSync(inputFile).toString();
                var hadMatches = false;
                try {
                    for (var _g = __values(this.distinguishConfig.types), _h = _g.next(); !_h.done; _h = _g.next()) {
                        var type = _h.value;
                        // Find all matches.
                        var matches = getAllMatches(new RegExp("_(" + type + ")[$-]([a-zA-Z0-9_-]+)", 'g'), contents);
                        for (var i = matches.length - 1; i >= 0; i--) {
                            // Iterate in reverse order to safely overwrite.
                            hadMatches = true; // there was at least a match somewhere
                            var _j = __read(matches[i], 3), fullMatch = _j[0], typeMatch = _j[1], name = _j[2];
                            var index = matches[i].index;
                            var renamed = renamer.addName(typeMatch, name);
                            contents =
                                contents.substr(0, index) +
                                    renamed +
                                    contents.substr(index + fullMatch.length);
                        }
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (_h && !_h.done && (_b = _g["return"])) _b.call(_g);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
                if (hadMatches) {
                    logStyle(STATUS, "Writing " + outputFile + " with namespace " + renamer.namespaces.join('/'));
                }
                ensureDirectoryExistence(outputFile, this.dirnameFn, this.fs);
                this.fs.writeFileSync(outputFile, contents.toString());
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d["return"])) _a.call(_d);
            }
            finally { if (e_7) throw e_7.error; }
        }
        var overallTime = Date.now() - startTime;
        logStyle(BOLD, "\nWrote output in " + overallTime / 1000 + "s");
        var danglers = this.rootRenamer.danglingImports();
        if (danglers.length > 0)
            console.log('\n');
        try {
            for (var danglers_1 = __values(danglers), danglers_1_1 = danglers_1.next(); !danglers_1_1.done; danglers_1_1 = danglers_1.next()) {
                var _k = danglers_1_1.value, sourceNamespace = _k.sourceNamespace, importNamespace = _k.importNamespace, type = _k.type, name = _k.name;
                logStyle(WARN, "Dangling import: " + sourceNamespace + " imports unused {type: " + type + ", name: " + name + "} from " + importNamespace);
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (danglers_1_1 && !danglers_1_1.done && (_c = danglers_1["return"])) _c.call(danglers_1);
            }
            finally { if (e_9) throw e_9.error; }
        }
    };
    return Distinguisher;
}());

var e_1;
var _a;
function toggleSrcIndex(toggleClass) {
    return "\n<link rel=\"stylesheet\" href=\"toggle/toggle.css\">\n\n<style>\n  ." + toggleClass + " {\n    background: green;\n  }\n</style>\n\n<div class=\"" + toggleClass + "\"></div>\n\n<script src=\"toggle/toggle.js\"></script>";
}
function toggleToggleCss(toggleClass) {
    return "\n  ." + toggleClass + " {\n    background: blue;\n  }";
}
function toggleToggleJs(toggleClass) {
    return "\n  // Create a toggle element from scratch.\n  const div = document.createElement('div');\n  div.classList.add('" + toggleClass + "');\n  \n  // Code to render it.\n  ...";
}
var fs = new VirtualFs();
fs.writeFileSync('/src/index.html', toggleSrcIndex('_cls-toggle'));
fs.writeFileSync('/src/toggle/toggle.css', toggleToggleCss('_cls-toggle'));
fs.writeFileSync('/src/toggle/toggle.js', toggleToggleJs('_cls-toggle'));
fs.writeFileSync('/src/toggle/.namespec', 'namespace toggle');
var config = {
    inputDir: '/src/',
    outputDir: '/out/',
    incrementer: 'minimal',
    types: ['cls', 'id'],
    exclude: []
};
var d = new Distinguisher(config, fs, fs.dirname);
d.run();
try {
    for (var _b = __values([
        '/out/index.html',
        '/out/toggle/toggle.css',
        '/out/toggle/toggle.js',
    ]), _c = _b.next(); !_c.done; _c = _b.next()) {
        var file = _c.value;
        console.log(file, fs.readFileSync(file).toString());
    }
}
catch (e_1_1) { e_1 = { error: e_1_1 }; }
finally {
    try {
        if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
    }
    finally { if (e_1) throw e_1.error; }
}
