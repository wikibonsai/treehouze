import resolve from '@rollup/plugin-node-resolve';
import commonJs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import postCss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';
// import dts from 'rollup-plugin-dts';
import pkg from './package.json';


// ref: https://github.com/vasturiano/force-graph/blob/master/rollup.config.js

const shared = {
  format: 'umd',
  name: 'TreeHouze',
  banner: `// ${pkg.name} v${pkg.version} - ${pkg.repository.url}`
};

export default [
  { // UMD
    input: 'src/index.js',
    output: [
      {
        ...shared,
        file: pkg.main,
        sourcemap: true
      },
      { // minify
        ...shared,
        file: pkg.unpkg,
        plugins: [terser({
          output: { comments: '/Version/' }
        })]
      }
    ],
    plugins: [
      postCss({ plugins: [] }),
      babel({ exclude: 'node_modules/**' }),
      resolve(),
      commonJs()
    ]
  },
  { // ES module
    input: 'src/index.js',
    output: [
      {
        format: 'es',
        file: pkg.module,
      }
    ],
    external: [
      ...Object.keys(pkg.dependencies || {})
    ],
    plugins: [
      postCss({ plugins: [] }),
      babel()
    ]
  },
];
