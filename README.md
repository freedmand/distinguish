CSS is great, but I could never get over how difficult it is to namespace class names safely.

And I always wanted an easy way to minify class names for production lest everyone know I named a slider class `cool-slider` to avoid a naming conflict I probably invented in the back of my head.

In short, it's been a chore to deal with CSS class names (and ID selectors), and that's been a large part of why it's hard to share modular web components that aren't just pure JavaScript. For these reasons, I wanted a general-purpose name compilation tool that is as simple as possible but highly flexible. So I created it.

# Distinguish

The basic idea of Distinguish is that you mark up your CSS classes slightly to be machine-parseable, and then the program will take care of all the heavy lifting to minify names and avoid naming conflicts across modules.

Whereas before you might write a CSS class as `.search` or an ID as `#search`, now you write `_cls-search` and `_id-search`. This does a few things.

* Tell Distinguish that you are dealing with `cls`, a CSS class type, and `id`, an ID type. By keeping track, Distinguish knows which context the name `search` is in and can work its magic accordingly.
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

Now if you run Distinguish and specify minifying as much as possible, you'll get the following as output:

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
npx distinguish rename
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

* **simple**: pretty much preserve the name unless there's a naming conflict. A good mode for development. If there's a conflict, `_1` is appended to the end of the name, then `_2` if there's another conflict, and so on.

* **module**: essentially the same thing as the simple mode, except the namespace is prepended to the name. If you're in a namespace called `component`, you may product a class name like `_cls-component_search`.

### Types

While the examples have been laser-focused on CSS classes and IDs, there's no limit to what types can be renamed. Distinguish was designed to support whatever types you want. `['cls', 'id']` is the default configuration, but you're free to modify or do away with those types.

Distinguish will modify any string of the form `_{type}-{name}` that it encounters in the files it recursively crawls in the input directory, where `{type}` is the type name (e.g. `cls`). For compatibility with JavaScript naming rules, `_{type}${name}` is also transformed.

For example, you could add the type `fn` and then have your JavaScript functions automatically minified (e.g. `_fn$parse()` -> `a`).
