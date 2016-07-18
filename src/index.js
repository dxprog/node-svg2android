'use strict';

const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const phantom = require('phantom');

const pathToIndex = path.resolve(__dirname, '..', 'svg2android', 'index.html');

/**
 * The code that runs inside phantom to invoke the converter
 */
function convert(xmlData, id) {
  // We'll run this async so there can by many conversion in flight at once
  setTimeout(function() {
    var result = {};
    try {
      result = generateCode(xmlData);
      result.id = id;
    } catch (exc) {
      result = { id: id, exc: exc };
    }
    window.callPhantom(result);
  }, 1);

  return id;
}

module.exports = class SvgToAndroid {
  constructor() {
    this.phantom = null;
    this.page = null;
    this.ready = null;
    this.callbacks = {};
  }

  /**
   * Starts up the converter environment
   *
   * @return {Promise} Resolves when ready, rejects on error
   */
  start() {
    return new Promise((resolve, reject) => {
      phantom
        .create()
        .then((instance) => {
          this.phantom = instance;
          return instance.createPage();
        })
        .then((page) => {
          this.page = page;
          return page.open(pathToIndex);
        })
        .then((status) => {
          if (status === 'success') {
            this.page.on('onCallback', this.fileConverted.bind(this));
            resolve();
          } else {
            reject(status);
          }
        })
        .catch(reject);
    });
  }

  /**
   * Callback from phantom with the conversion result
   *
   * @private
   */
  fileConverted(conversionResult) {
    if (typeof conversionResult !== 'object' || !conversionResult.id) {
      console.error('Invalid response back from phantom', conversionResult);
    } else {
      const cb = this.callbacks[conversionResult.id];
      if (cb) {
        cb(conversionResult);
      } else {
        console.error(`Unable to find callback for conversion ${conversionResult.id}`);
      }
    }
  }

  /**
   * Sanitize the SVG file to prepare for conversion to Android Vector Drawable format.
   * Remove the references to currentColor
   *
   * @private
   */
   sanitizeSvgBeforeAvdConversion(data) {
     return data.split('currentColor').join('#000000');
  }

  /**
   * Invokes the converter
   *
   * @param {String} filePath The path to the SVG file
   * @return {Promise} Resolves with the conversion result or rejects on error
   */
  convert(filePath) {
    return new Promise((resolve, reject) => {
      // Verify that the phantom session is alive first
      if (!this.phantom || !this.page) {
        reject({ exc: new Error('There is no conversion session open') });
        return;
      }

      // Read in the file and send it out for conversion
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject({ exc: err });
        } else {
          data = this.sanitizeSvgBeforeAvdConversion(data.toString());
          var id = md5(data);
          this.callbacks[id] = (result) => {
            // Reject the promise if there are warnings during conversion
            // Examples are if the SVG has gradients or transforms which are not supported in AVD
            if (result.warnings) {
              reject(result.warnings);
            } else if (!result.exc) {
              resolve(result);
            } else {
              reject(result.exc);
            }
          };
          this.page.evaluate(convert, data, id);
        }
      });
    });
  }

  /**
   * Ends the conversion session
   */
  end() {
    this.page.close();
    this.phantom.exit();
    this.page = null;
    this.phantom = null;
  }
};
