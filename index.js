import MagicString from 'magic-string';
import {createFilter} from 'rollup-pluginutils';
import {Renamer} from './out/renamer.js';
import {match} from 'micromatch';

function getAllMatches(regex, str) {
  var result;
  const results = [];
  while ((result = regex.exec(str)) !== null) {
    results.push(result);
  }
  return results;
}

export function condense(options) {
  options = options || {};
  if (!options.include) options.include = ['**/*.css', '**/*.js', '**/*.html'];

  const filter = createFilter(options.include, options.exclude);

  const types = ['cls', 'id'];
  const renamer = new Renamer(types);

  return {
    name: 'condense',
    transform: (code, id) => {
      const parts = id.split('/').filter(x => x != '');
      const namespace = renamer.getNamespace(parts.slice(0, parts.length - 1));
      if (filter(id)) {
        const s = new MagicString(code);

        for (const type of types) {
          // Find all matches.
          const matches = getAllMatches(
            new RegExp(`_(${type})-([a-zA-Z0-9_-]+)`, 'g'),
            s.toString()
          );
          for (let i = 0; i < matches.length; i++) {
            const [fullMatch, typeMatch, name] = matches[i];
            const {index} = matches[i];
            const renamed = namespace.addName(typeMatch, name);
            console.log('RRR', renamed, namespace.namespaces);
            s.overwrite(index, index + fullMatch.length, renamed);
          }
        }

        console.log('s', s.toString());
        return {
          code: s.toString(),
          map: s.generateMap(),
        };
      }
    },
  };
}
