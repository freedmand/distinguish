CSS is great but I could never get over how difficult it is to namespace class names safely.

And I always wanted an easy way to minify class names for production lest everyone know I named a slider class `cool-slider` to avoid a naming conflict I probably invented in the back of my head.

In short, it's been a chore to deal with CSS class names (and ID selectors), and that's been a large part of why it's hard to share modular web components that aren't just pure JavaScript. For these reasons, I wanted a name compilation tool that is as simple as possible but highly flexible. So I created it.

# Distinguish

The basic idea of Distinguish is that you mark up your CSS classes slightly to be machine-parseable, and then the program will take care of all the heavy lifting in avoiding naming conflicts across modules and minifying names.

Whereas before you might write a CSS class as `.search` or an ID as `#search`, now you write `_cls-search` and `_id-search`. This does a few things.

* Tell Distinguish that you are dealing with `cls`, a CSS class type, and `id`, an ID type. By keeping track, Distinguish knows which context the name `search` is in and can work its magic accordingly.
* Uses a naming convention with an underscore and hyphen in the name selector that's easy to parse and unlikely to conflict with anything else.

Distinguish does not require separate logic for handling CSS, HTML, JS, or any other language (like Sass, TypeScript, etc.) -- rather, the name carries on its own. Distinguish by default will operate on all files in a source directory.

Let's say you have a folder with the following files in it.

index.html:
```html
<div class="_cls-content" id="_id-content">Main content here</div>
```

main.js:
```javascript
document.getElementById('_id-content').textContent = 'Injected content.';
```

style.css:
```css
._cls-content {
  border-radius: 100px;  /* so smooth */
}
```

Now if you run Distinguish and specify minifying as much as possible, you'll get the following as output.

index.html:
```html
<div class="a" id="a">Main content here</div>
```

main.js:
```javascript
document.getElementById('a').textContent = 'Injected content.';
```

style.css:
```css
.a {
  border-radius: 100px;  /* so smooth */
}
```

Notice how the minification can reduce both a class and an ID to the same selector `a`. By keeping track of type, Distinguish can get the best possible results.