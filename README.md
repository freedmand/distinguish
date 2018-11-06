CSS is great, but isn't it tricky to namespace class names safely?

And shouldn't there be an easy way to minify class names for production lest everyone know you named a slider class `cool-slider` (to avoid that naming conflict you probably invented in the back of your head).

In short, it can be a chore to deal with CSS class names (and ID selectors), and that's been a large part of why it's hard to share modular web components that aren't just pure JavaScript. For these reasons, there should be a general-purpose name compilation tool that is as simple as possible but highly flexible.

Introducing...

# Distinguish [![Build Status](https://travis-ci.org/freedmand/distinguish.svg?branch=master)](https://travis-ci.org/freedmand/distinguish)

The basic idea of Distinguish is that you mark up your CSS classes slightly to be machine-parseable, and then the program will take care of all the heavy lifting to minify names and avoid naming conflicts across modules.

Whereas before you might write a CSS class as `.search` or an ID as `#search`, now you write `_cls-search` and `_id-search`. This does a few things.

* Tells Distinguish that you are dealing with `cls`, a CSS class type, and `id`, an ID type. By keeping track, Distinguish knows which context the name `search` is in and can work its magic accordingly.
* Uses a naming convention with an underscore and hyphen in the name selector that's easy to parse and unlikely to conflict with anything else.

Distinguish does not require separate logic for handling CSS, HTML, JS, or any other language (like Sass, TypeScript, etc.) — rather, the name carries on its own. Distinguish by default will operate on all files in a specified source directory.

Let's say you have an HTML file that has some CSS and JS in it.

```html
<style>
  ._cls-content {
    border-radius: 100px;  /* so smooth */
  }
</style>

<div class="_cls-content" id="_id-content">Main content here</div>

<script>
  document.getElementById('_id-content').textContent = 'Injected content.';
</script>
```

If you run Distinguish and specify minifying as much as possible, you'll get the following as output:

```html
<style>
  .a {
    border-radius: 100px;  /* so smooth */
  }
</style>

<div class="a" id="a">Main content here</div>

<script>
  document.getElementById('a').textContent = 'Injected content.';
</script>
```

That's it. No tricks or special magic. Just pure regular expression parsing and an intelligent naming module that can keep track of multiple types. And a nice perk is that this naming mechanism works without compiling as well as long as there's no naming collisions.

That's a taste of Distinguish, a renaming tool that works on any file and can be used in many different ways. But it can also do much more, like namespace directories to avoid cross-module clashing, reserve certain names, and report unused dependencies.

## Getting started

Try out the Distinguish command-line utility without installing anything:

```bash
npx distinguish init
```

This will create a Distinguish config file in your current directory called `distinguish.config.js` that looks like this:

```javascript
exports.default = {
  incrementer: 'simple', // the incrementer to use ([minimal, simple, module])
  types: ['cls', 'id'], // the types to rename (e.g. CSS classes, IDs)

  inputDir: 'src/', // the input directory to use
  outputDir: 'out/', // the output directory to use

  exclude: [], // a regular expression array describing files to exclude from renaming
};
```

We'll dive into the options in the next section, but for now just set `inputDir` and `outputDir` to some directories you want to try out, where the input directory is some source code you want to transform, and the output directory is a clean directory where the results will be outputted.

For a minimal example, create an `index.html` in your `inputDir`:

```html
<style>
._cls-red {
  color: red;
}

<div class="_cls-red">Hello world.</div>
```

Now run Distinguish:

```bash
npx distinguish
```

In your output folder you should see the following:

```html
<style>
.red {
  color: red;
}

<div class="red">Hello world.</div>
```

Now try changing the incrementer to `minimal` in your `distinguish.config.js` and you should get a minimized class name of `a`.

To install Distinguish globally, run:

```bash
npm i -g distinguish
```

To install Distinguish as a dev dependency in Node, run:

```bash
npm i -D distinguish
```

## Config options

### Incrementer

Incrementers work behind the scenes to assign names. There's three main incrementers you can choose from:

* **minimal**: assigns names incrementally that are as short as possible, e.g. *a*, *b*, *c*, *...*, *y*, *z*, *aa*, *...*

* **simple**: pretty much preserve the name unless there's a naming conflict. A good mode for development. If there's a conflict, `_1` is appended to the end of the name, then `_2` if that conflicts, and so on.

* **module**: essentially the same thing as the simple mode, except the namespace is prepended to the name. If you're in a namespace called `component`, you may produce a class name like `_cls-component_search`.

### Types

While the examples have been laser-focused on CSS classes and IDs, there's no limit to what types can be renamed. Distinguish was designed to support whatever types you want. `['cls', 'id']` is the default configuration, but you're free to modify or do away with those types.

Distinguish will modify any string of the form `_{type}-{name}` that it encounters in the files it recursively crawls in the input directory, where `{type}` is the type name (e.g. `cls`). For compatibility with JavaScript variable naming rules, `_{type}${name}` is also transformed.

For example, you could add the type `fn` and then have your JavaScript functions automatically minified (e.g. `_fn$parse()` → `a`) — though I would never recommend doing this. Just use a JS minifier like Uglify or Closure compiler instead that actually understands your code's structure.

### Exclude

The `exclude` option in the config is an array of fully specified regular expressions for file names that you want to exclude. Note that you should use the regular expression start and end symbols (`/^ ... $/`) if you intend to match the whole name.

## The .namespec file

Distinguish specially handles any files named `.namespec` that it encounters in its crawl. The namespec file specifies the *namespace* of the current directory. Namespaces are covered more in the next section — they are essentially modules that treat instances of the same name differently to avoid collisions.

The namespec file can additionally import names from other namespaces as well as reserve certain names to be globally avoided in renaming.

### Namespaces

Namespaces provide a way to safely manage situations where you may have duplicate names that you want to treat differently in different contexts.

An example may be the easiest way to demonstrate it.

`src/index.html`:

```html
<link rel="stylesheet" href="toggle/toggle.css">

<style>
  ._cls-toggle {
    background: green;
  }
</style>

<div class="_cls-toggle"></div>

<script src="toggle/toggle.js"></script>
```

`src/toggle/toggle.css`:

```ss
._cls-toggle {
  background: blue;
}
```

`src/toggle/toggle.js`:

```javascript
// Create a toggle element from scratch.
const div = document.createElement('div');
div.classList.add('_cls-toggle');

// Code to render it.
...
```

In this example, there's a webpage (`src/index.html`) which is displaying a toggle. But it also imports CSS and JavaScript from a module called `toggle` which creates another toggle which coincidentally has the same class name.

We want the sub-directory `src/toggle` to have its own isolated naming context, such that when we import the code into `src/index.html` the names do not collide and the page can ultimately output a blue toggle and a green toggle.

Distinguish will not do anything special by default; the names will get tangled. Even though the files are in a different directory, they're in the same namespace. Let's change this by creating a namespec file in the `src/toggle` directory:

`src/toggle/.namespec`:

```
namespace toggle
```

Now, when we run Distinguish, all the names in the `src/toggle` directory (and any of its sub-directories, by default) will be treated differently. Specifically, if we compile with the minimal incrementer, `_cls-toggle` will map to `a` in the parent directory and `b` in the sub-directory.

Though this example is contrived, this is a common situation in managing large web projects. Namespaces specified in a namespec file provide a lightweight means to distinguish between duplicate names in different modules.

You may be asking why directories don't by default have different namespaces. This is because style sheets and other resources are often managed in different directories but intended to operate in the same namespace as the HTML files that depend on them. By forcing you to namespace with intention, the results will be more controlled.

### Anatomy of a namespace

By default, all Distinguish projects have a namespace of `root`. As Distinguish recurses into sub-directories and encounters new namespaces, these are chained onto the end.

For instance,

`src/a/.namespec`:

```
namespace a
```

This will endow the `src/a` directory with the namespace `root/a`.

If there's a sub-directory `b` within `a` that has its own namespec, the chain will grow.

`src/a/b/.namespec`

```
namespace b
```

Now, the `src/a/b` directory and its sub-directories will have the namespace `root/a/b`.

### Imports

Names can be imported across namespaces:

```
namespace lib

from barn import
  cls
    cat
    dog
    chipmunk
  id
    animal-house
```

This namespec file says to look in the sub-module `barn` and share the classes *cat*, *dog*, and *chipmunk* and the ID *animal-house*.

The syntax `from {namespace} import` will look in child namespaces by default. To look in parent namespaces or complex paths the following syntax can be used:

* `../barn`: look in the parent namespace's child named barn (i.e. a sibling namespace)
* `/`: look in the root namespace. The `/` at the beginning means the namespace is specified as an absolute
* `farm/barn/stable`: look in the namespace `farm`'s child named `barn`, and then get `barn`'s child named `stable`

Imports allow controlled leakage between components. For instance, a themes namespace may share specified class names with the root namespace to be able to modify CSS classes on the main web page.

### Reserved names

You may have a dependency which expects a certain class name or ID to be present that you have no control over (for instance, an analytics suite that expects to use a certain CSS class).

Fret not. There's a simple mechanism to avoid clobbering these global reserved names:

```
namespace lib

reserve
  cls
    analytics
  id
    analyzer
```

Now, if you use the class `_cls-analytics`, it will be renamed in a way that doesn't clash. For instance, if you're using the simple incrementer, it will be renamed `analytics_1`.

What if you want to specify the actual name `analytics`? Easy. Just write the class as `analytics` (remember, Distinguish only touches things that match the `_{type}-{name` form and its JS variant `_{type}${name}`).

Reserved names affect the global naming process, so a sub-namespace that reserves a certain name will prevent the root namespace from clobbering it.

## Unused dependencies

If you import a name from another module and then never actually make use of that name, you may have made an error. To help you, Distinguisher will warn you about every unused dependency. These warnings will not stop the output generation.
