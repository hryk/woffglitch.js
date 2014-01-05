// TODO: rewrite with [bitjs](http://code.google.com/p/bitjs/)
//       or, [ArrayBuffer](https://developer.mozilla.org/en/JavaScript_typed_arrays/ArrayBuffer)
(function(exports){
  'use strict';

  /**
   * Functions for handle binaries.
   * @namespace
   */
  var BinUtil = {
    /**
     * Read bytes from string.
     *
     * @private
     * @param {String} data String representation of binary data.
     * @param {Integer} start Position of start to read.
     * @param {Integer} length Length of bytes to read.
     * @param {Boolean} convert integer to 0x**
     * @return {Array} ByteArray
     */
    read_bytes: function(bytestring, start, length, conv){
      if (typeof start  === 'undefined') start  = 0;
      if (typeof conv  === 'undefined')  conv  = false;
      if (typeof length === 'undefined') length = bytestring.length;
      var str    = bytestring.substr(start, length),
          bytes  = [],
          ch, st = [];
      //
      // http://stackoverflow.com/questions/1240408/reading-bytes-from-a-javascript-string
      //
      for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);  // get char
        st = [];                 // set up "stack"
        st.push( ch & 0xFF );    // push byte to stack
        ch = ch >> 8;            // shift value down by 1 byte
        // add stack contents to result
        // done because chars have "wrong" endianness
        bytes = bytes.concat( st.reverse() );
      }
      for (var j=0;j<bytes.length;j++) {
        if (conv) {
          bytes[j] = "0x"+bytes[j].toString(16);
        }
        else {
          bytes[j] = bytes[j].toString(16);
        }
      }
      return bytes;
    },
   /**
    * Convert bytes array to string (for header and table_dirs)
    *
    * @private
    * @param {String} type type of value (string, uint32, uint16)
    * @param {Array}  bytes values as ByteArray
    * @return {String} String/Integer Values.
    */
    bytes_to: function(type, bytes){
      switch(type){
        case "string":
          return BinUtil.bytes_to_string(bytes);
        case "uint32":
          return BinUtil.bytes_to_uint32(bytes);
        case "uint16":
          return BinUtil.bytes_to_uint16(bytes);
        default:
          throw new TypeError("bytes_to could not handle type '"+type+"'");
      }
      return false;
    },
    /**
     * Convert string to bytes array (for header and table_dirs)
     *
     * @private
     * @param {String} type type of value (string, uint32, uint16)
     * @param {String} value values
     * @return {Array} ByteArray
     */
    bytes_from: function(type, value){
      switch(type){
        case "string":
          return BinUtil.read_bytes(value, 0, value.length);
        case "uint32":
          return BinUtil.uint32_to_bytes(value);
        case "uint16":
          return BinUtil.uint16_to_bytes(value);
        default:
          throw new TypeError("bytes_from could not handle type '"+type+"'");
      }
      return false;
    },
    /**
     * Convert ByteArray to String
     *
     * @private
     * @param {Array} bytes ByteArray
     * @return {String} String
     */
    bytes_to_string: function(bytes){
      var str = "";
      for (var i=0; i < bytes.length; i++) {
        str += String.fromCharCode("0x"+bytes[i]);
      }
      return str;
    },
    /**
     * Convert ByteArray to UInt32
     *  http://stackoverflow.com/questions/6145390/deserialize-function-byte-array-to-uint32
     *
     * @private
     * @param {Array} bytes ByteArray
     * @return {Integer} UInt32 value
     */
    bytes_to_uint32: function(bytes){
      if (bytes.length != 4)
        throw new Error("bytes_to_uint32: invalid byte-array.");
      var value = 0;
      value |= parseInt("0x"+bytes[0], 16) << 24;
      value |= parseInt("0x"+bytes[1], 16) << 16;
      value |= parseInt("0x"+bytes[2], 16) << 8;
      value |= parseInt("0x"+bytes[3], 16);
      if (value > Math.pow(2, 32)) value = value - Math.pow(2, 32);
      if (value < 0) value = Math.pow(2, 32) + value;
      return value;
    },
    /**
     * Convert ByteArray to UInt16
     *
     * @private
     * @param {Array} bytes ByteArray
     * @return {Integer} UInt16 value
     */
    bytes_to_uint16: function(bytes){
      if (bytes.length != 2)
        console.error('bytes_to_uint16: invalid byte-array.');
      var value = 0;
      value |= parseInt("0x"+bytes[0], 16) << 8;
      value |= parseInt("0x"+bytes[1], 16);
      return value;
    },
    /**
    * Convert UInt32 to ByteArray
    *
    * @private
    * @param {Integer} value UInt32 value
    * @return {Array} ByteArray
    */
    uint32_to_bytes: function(value, conv){
      var bytes = [];
      if (typeof conv  === 'undefined') conv  = false;
      value = parseInt(value, 10);
      bytes[0] = (value & 0xff000000) >> 24;
      bytes[1] = (value & 0x00ff0000) >> 16;
      bytes[2] = (value & 0x0000ff00) >> 8;
      bytes[3] = (value & 0x000000ff);
      for (var j=0;j<bytes.length;j++) {
        if (conv) {
          bytes[j] = "0x"+bytes[j].toString(16);
        }
        else {
          bytes[j] = bytes[j].toString(16);
        }
      }
      return bytes;
    },
    /**
     * Convert UInt16 to ByteArray
     *
     * @private
     * @param {Integer} value UInt16 value
     * @return {Array} ByteArray
     */
    uint16_to_bytes: function (value) {
      var bytes = [];
      value = parseInt(value, 10);
      bytes[0] = (value & 0x0000ff00) >> 8;
      bytes[1] = (value & 0x000000ff);
      return bytes;
    },
    /**
     * Inflate ByteString
     *
     * @param {String} bytes byte-string.
     * @return {String} inflated byte-string.
     */
     inflate : function(binstr){
       if (typeof(binstr) === 'undefined' || typeof(binstr) == 'object') {
         throw new TypeError("_inflate: Invalid argument. argument must be String.");
       }
       return RawDeflate.inflate(binstr);
     },
    /**
     * Deflate ByteString
     *
     * @param {String} bytes byte-string.
     * @return {String} deflated byte-string.
     */
     deflate: function(binstr){
       if (typeof(binstr) === 'undefined' || typeof(binstr) == 'object') {
         throw new TypeError("deflate: Invalid argument. argument must be String.");
       }
       return RawDeflate.deflate(binstr);
     }
  };

  // Export
	if(typeof define === 'function' && define.amd) {
    define(function() { return BinUtil; });
	}
	else {
		exports.BinUtil = BinUtil;
	}
})(this);
