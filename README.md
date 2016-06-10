# Node svg2android

A PhantomJS wrapped version of [svg2android](https://github.com/inloop/svg2android) for access to nodejs applications.

## Installing

```
npm install --save node-svg2android
```

## Example Use

```javascript
const SvgToAndroid = require('node-svg2android');

const converter = new SvgToAndroid();
converter.start().then(() => {
  converter.convert('/path/to/svg').then((result) => {
    // result.code -> This is the actual VectorDrawable code as returned by svg2android
    // result.warnings -> Any warnings raised by svg2android
    // result.error -> Errors raised by svg2android
    converter.end();
  }, (err) => {
    console.error('There was some error converting', err);
  });
});
```