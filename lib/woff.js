// TODO: Embbed LICENSE.
//
// Dependencies : base64.js, EventEmitter.js, jQuery.js, rawdeflate.js, rawinflate.js
//
// * _と__について
//  privateなデータは__, privateなmethodは_を接頭辞に持っている。
//

(function(exports){
  'use strict';

  /**
   * Binary handling Functions
   * @namespace
   */

  /**
   * WOFF Object constructor.
   *
   * @public
   * @param {String} rawdata WOFF data.
   */
  function WOFF(rawdata){
    this.__data         = rawdata;
    this.__woff_header  = {};
    this.__table_dirs   = [];
    this.__font_tables  = [];
    this.__ext_metadata = {};
    this.__private_data = {};
    this._modified     = false;
    this._parse();
    // EventEmitter
    this._events = {};
		this._maxListeners = 10;
  };

  // Inherit from EventEmitter.
  WOFF.prototype = EventEmitter.prototype;

  /**
   * WOFF variable names and types.
   * http://www.w3.org/TR/WOFF/
   *
   * @constant
   */
  WOFF.prototype.__SPEC = {
    header : {
      signature       : "string",
      flabor          : "uint32",
      length          : "uint32",
      num_tables      : "uint16",
      reserved        : "uint16",
      total_sfnt_size : "uint32",
      major_version   : "uint16",
      minor_version   : "uint16",
      meta_offset     : "uint32",
      meta_length     : "uint32",
      meta_org_length : "uint32",
      priv_offset     : "uint32",
      priv_length     : "uint32"
    },
    table_dir: {
      tag:           "string",
      offset:        "uint32",
      comp_length:   "uint32",
      orig_length:   "uint32",
      orig_checksum: "uint32"
    },
  };

  /**
   * Convert string to bytes array (for header and table_dirs)
   *
   * @private
   * @param {String} val values
   * @param {String} type type of value (string, uint32, uint16)
   * @return {Array} ByteArray
   */
  WOFF.prototype._to_bytes = function(val, type) {
    switch(type){
      case "string":
        return this._read_bytes(val, 0, val.length);
      break;
      case "uint32":
        return this._uint32_to_b(val);
      break;
      case "uint16":
        return this._uint16_to_b(val);
      break;
    };
  };

  /**
   * Convert bytes array to string (for header and table_dirs)
   *
   * @private
   * @param {Array} bytes values as ByteArray
   * @param {String} type type of value (string, uint32, uint16)
   * @return {String} String/Integer Values.
   */
  WOFF.prototype._from_bytes = function(bytes, type) {
    switch(type){
      case "string":
        return this._b_to_str(bytes);
      break;
      case "uint32":
        return this._b_to_uint32(bytes);
      break;
      case "uint16":
        return this._b_to_uint16(bytes);
      break;
    };
  };

  /**
   * Read bytes from string.
   *
   * @private
   * @param {String} data String representation of binary data.
   * @param {Integer} start Position of start to read.
   * @param {Integer} length Length of bytes to read.
   * @return {Array} ByteArray
   */
  WOFF.prototype._read_bytes = function(data, start, length) {
    var str = data.substr(start, length);
    var bytes  = [];
    var ch, st = [];
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
      bytes[j] = bytes[j].toString(16);
    }
    return bytes;
  }

  /**
   * Convert ByteArray to String
   *
   * @private
   * @param {Array} bytes ByteArray
   * @return {String} String
   */
  WOFF.prototype._b_to_str = function(bytes){
    var str = "";
    for (var i=0; i < bytes.length; i++) {
      str += String.fromCharCode("0x"+bytes[i]);
    }
    return str;
  }

  /**
   * Convert ByteArray to UInt32
   *  http://stackoverflow.com/questions/6145390/deserialize-function-byte-array-to-uint32
   *
   * @private
   * @param {Array} bytes ByteArray
   * @return {Integer} UInt32 value
   */
  WOFF.prototype._b_to_uint32 = function(bytes){
    if (bytes.length != 4) console.error('_uint32(): invalid byte-array.');
    var value = 0;
    value |= parseInt("0x"+bytes[0]) << 24;
    value |= parseInt("0x"+bytes[1]) << 16;
    value |= parseInt("0x"+bytes[2]) << 8;
    value |= parseInt("0x"+bytes[3]);
    if (value < 0) value = -1 * value;
    return value;
  };

  /**
   * Convert ByteArray to UInt16
   *
   * @private
   * @param {Array} bytes ByteArray
   * @return {Integer} UInt16 value
   */
  WOFF.prototype._b_to_uint16 = function(bytes){
    if (bytes.length != 2) console.error('_uint32(): invalid byte-array.');
    var value = 0;
    value |= parseInt("0x"+bytes[0]) << 8;
    value |= parseInt("0x"+bytes[1]);
    return value;
  };

  /**
   * Convert UInt32 to ByteArray
   *
   * @private
   * @param {Integer} value UInt32 value
   * @return {Array} ByteArray
   */
  WOFF.prototype._uint32_to_b = function(value){
    var bytes = [];
    value = parseInt(value);
    bytes[0] = (value & 0xff000000) >> 24;
    bytes[1] = (value & 0x00ff0000) >> 16;
    bytes[2] = (value & 0x0000ff00) >> 8;
    bytes[3] = (value & 0x000000ff);
    return bytes;
  };

  /**
   * Convert UInt16 to ByteArray
   *
   * @private
   * @param {Integer} value UInt16 value
   * @return {Array} ByteArray
   */
  WOFF.prototype._uint16_to_b = function(value){
    var bytes = [];
    value = parseInt(value);
    bytes[0] = (value & 0x0000ff00) >> 8;
    bytes[1] = (value & 0x000000ff);
    return bytes;
  };

  /**
   * Inflate ByteString
   *
   * @param {String} bytes byte-string.
   * @return {String} inflated byte-string.
   */
  WOFF.prototype._inflate = function(bytes){
    if (typeof(bytes) === 'undefined' || typeof(bytes) == 'object') {
      console.error('_inflate: Invalid argument. argument is String.')
      return false;
    }
    return RawDeflate.inflate(bytes);
  };

  /**
   * Deflate ByteString
   *
   * @param {String} bytes byte-string.
   * @return {String} deflated byte-string.
   */
  WOFF.prototype._deflate = function(bytes){
    if (typeof(bytes) === 'undefined' || typeof(bytes) == 'object') {
      console.error('_inflate: Invalid argument. argument is String.')
      return false;
    }
    return RawDeflate.deflate(bytes);
  };

  /**
   * Return flavor as String
   *
   * @public
   * @return {String} ttf, cff
   */
  WOFF.prototype.flavor = function(){
    // 0x00010000, 0x74727565 : TrueType
    // 0x4F54544F : CFF glyph data
  };

  /**
   * Parsing WOFF header and Table Directories.
   *
   * @private
   */
  WOFF.prototype._parse = function(){
    var current = 0;
    // Parse header
    this.__woff_header = {
      signature       : this._read_bytes(this.__data, current, 4),
      // The flavor field corresponds to the "sfnt version" field found at the
      // beginning of an sfnt file, indicating the type of font data contained.
      // Although only fonts of type 0x00010000 (the version number 1.0 as a
      // 16.16 fixed-point value, indicating TrueType glyph data) and 0x4F54544F
      // (the tag 'OTTO', indicating CFF glyph data) are widely supported at
      // present, it is not an error in the WOFF file if the flavor field
      // contains a different value, indicating a WOFF-packaged version of a
      // different sfnt flavor. (The value 0x74727565 'true' has been used for
      // some TrueType-flavored fonts on Mac OS, for example.) Whether client
      // software will actually support other types of sfnt font data is outside
      // the scope of the WOFF specification, which simply describes how the
      // sfnt is repackaged for Web use.
      flabor          : this._read_bytes(this.__data, (current+=4), 4),
      length          : this._read_bytes(this.__data, (current+=4), 4),
      num_tables      : this._read_bytes(this.__data, (current+=4), 2),
      reserved        : this._read_bytes(this.__data, (current+=2), 2),
      // totalSfntSize:
      //  Total size needed for the uncompressed font data,
      //  including the sfnt header, directory, and font tables
      total_sfnt_size : this._read_bytes(this.__data, (current+=2), 4),
      major_version   : this._read_bytes(this.__data, (current+=4), 2),
      minor_version   : this._read_bytes(this.__data, (current+=2), 2),
      meta_offset     : this._read_bytes(this.__data, (current+=2), 4),
      meta_length     : this._read_bytes(this.__data, (current+=4), 4),
      meta_org_length : this._read_bytes(this.__data, (current+=4), 4),
      priv_offset     : this._read_bytes(this.__data, (current+=4), 4),
      priv_length     : this._read_bytes(this.__data, (current+=4), 4)
    };
    console.log('current position: '+current);
    console.log("sig: "+this._b_to_str(this.__woff_header.signature));
    console.log("flabor: "+this._b_to_uint32(this.__woff_header.flabor));
    console.log(this.__woff_header.flabor);
    console.log("length: "+this._b_to_uint32(this.__woff_header.length));
    console.log("tables: "+this._b_to_uint16(this.__woff_header.num_tables));
    console.log("sfnt_size: "+this._b_to_uint32(this.__woff_header.total_sfnt_size));
    console.log("major v: "+this._b_to_uint16(this.__woff_header.major_version));
    console.log("minor v: "+this._b_to_uint16(this.__woff_header.minor_version));
    console.log("meta offset: "+this._b_to_uint32(this.__woff_header.meta_offset));
    console.log("meta length: "+this._b_to_uint32(this.__woff_header.meta_length));
    console.log("priv offset: "+this._b_to_uint32(this.__woff_header.priv_offset));
    console.log("priv length: "+this._b_to_uint32(this.__woff_header.priv_length));
    this.__table_dirs = [];
    // Reading table directories.
    for (var i=0; i<this._b_to_uint16(this.__woff_header.num_tables);i++) {
      current += 4;
      this.__table_dirs.push({
        index: i,
        tag:           this._read_bytes(this.__data, current,      4),
        offset:        this._read_bytes(this.__data, (current+=4), 4),
        comp_length:   this._read_bytes(this.__data, (current+=4), 4),
        orig_length:   this._read_bytes(this.__data, (current+=4), 4),
        orig_checksum: this._read_bytes(this.__data, (current+=4), 4)
      });
      console.log("---------------------------------------------");
      console.log("tag: "+this._b_to_str(this.__table_dirs[i].tag));
      console.log("offset: "+this._b_to_uint32(this.__table_dirs[i].offset));
      console.log("comp_len: "+this._b_to_uint32(this.__table_dirs[i].comp_length));
      console.log("orig_len: "+this._b_to_uint32(this.__table_dirs[i].orig_length));
      console.log("orig_checksum: "+this._b_to_uint32(this.__table_dirs[i].orig_checksum));
    }
  };

  /**
   * Get table directory by tag name.
   *
   * @public
   * @param {String} tag Font table index.
   * @return {Object} A table directory.
   */
  WOFF.prototype.table_dir_by_tag = function(tag){
    var table;
    for (var dir in this.__table_dirs) {
      if (this._b_to_str(this.__table_dirs[dir].tag) === tag) {
        table = this.table_dir(dir);
        break;
      }
    }
    return table;
  };

  /**
   * Get converted table directory by index.
   *
   * @public
   * @param {Integer} index Font table index.
   * @return {Object} A table directory.
   */
  WOFF.prototype.table_dir = function(index){
    if (index >= this.__table_dirs.length) {
      console.error('table_dir: index out of bounds');
      return false;
    }
    // Converting byte-arrays to values.
    var new_dir = {};
    var dir = this.__table_dirs[index];
    new_dir.index = dir.index;
    for (var k in dir) {
      if (k != 'index')
        new_dir[k] = this._from_bytes(dir[k], this.__SPEC.table_dir[k]);
    }
    return new_dir;
  };

  // TTF Checksum.
  // https://developer.apple.com/fonts/TTRefMan/RM06/Chap6.html
  //
  WOFF.prototype._calc_table_checksum = function(str) {

  };

  WOFF.prototype._set_uncompressed_font_table = function(index, value) {
    if (typeof(value) === 'object')
      value = this._b_to_str(value);
    var that = this;
    var checksum = this._calc_table_checksum(value);
    // 先頭4byteがパディングの場合かつパディングが無い場合、パディングを付加する(4byte 0)
    setTimeout(function(){
      that.__table_dirs[index].orig_checksum = checksum;
      that.__table_dirs[index].comp_length = value.length;
      that.__table_dirs[index].orig_length = value.length;
      that.__font_tables[index] = value;
    }, 0);
  };

  WOFF.prototype._set_compressed_font_table = function(index, value) {
    if (typeof(value) === 'object')
     value = this._b_to_str(value);
    var that = this;
    setTimeout(function(){
      that.__font_tables[index]            = comp_value;
      that.__table_dirs[index].comp_length = comp_value.length;
      that.__table_dirs[index].orig_length = value.length;
      var checksum = that._calc_checksum(value);
      setTimeout(function(){
        that.__table_dirs[index].orig_checksum = checksum;
      }, 0);
    },0);
  };

  WOFF.prototype._get_uncompressed_font_table = function(index) {
    var table_info = this.table_dir(index);

    if (typeof(this.__font_tables[index]) === "undefined")
      this.__font_tables[index] = this.__data.substr(table_info.offset,
                                                     table_info.orig_length);
    return this.__font_tables[index];
  };

  WOFF.prototype._get_compressed_font_table = function(index) {
    var table_info = this.table_dir(index);

    if (typeof(this.__font_tables[index]) === "undefined") {
      //
      // 先頭4byteがパディングの場合、2バイト文字なのでoffset+2する。
      //
      // The OpenType/OFF specification is not entirely clear about whether all
      // tables in an sfnt font must be padded with 0-3 zero bytes to a
      // multiple of 4 bytes in length, or whether this applies only between
      // tables, and the final table of the file may be left unpadded.
      var offset = table_info.offset;
      if (table_info.index > 1) offset += 2;
      var compressed = this.__data.substr(offset, table_info.comp_length);
      var that = this;
      this.__font_tables[index] = RawDeflate.inflate(compressed);
      setTimeout(function(){
        that.emit('inflated_table', that.__font_tables[index], this);
      }, 0);
    }
    return this.__font_tables[index];
  };

  /**
   * Get/Set font table data.
   *
   * @public
   * @param {Integer} index Font table index.
   * @param {String,Array} value Font table data.
   * @return {String,Boolean} Table data (getter) or Success (setter).
   */
  WOFF.prototype.font_table = function(index, value){
    var table_info = this.__table_dirs[index];
    // Checking arguments
    if (typeof(index) == "undefined") {
      console.error('WOFF.font_table: index is missing');
      return false;
    }
    else {
      var set = false;
      if (typeof(index) == "undefined") set = true;

      if (table_info.comp_length === table_info.orig_length) {
        if (set) {
          return this._set_uncompressed_font_table(index, value);
        }
        else {
          return this._get_uncompressed_font_table(index);
        }
      }
      else {
        if (set) {
          // 6. Font Data Tables
          //
          // The font data tables in the WOFF file are exactly the same as the
          // tables in the input font, except that each table MAY have been
          // compressed.
          //
          return this._set_uncompressed_font_table(index, value);
        }
        else {
          this._get_compressed_font_table(index);
          return this;
        }
      }
    }
  };

  /**
   * Get/Set WOFF header data.
   *
   * @public
   * @param {String} name Header name.
   * @param {String,Array} value Font table data.
   * @return {String,Boolean} Header data (getter) or Success (setter).
   */
  WOFF.prototype.header = function(name, value){
    if (typeof(name) !== "undefined") {
      if (typeof(this.__SPEC.header[name]) === "undefined") {
        console.error("WOFF.header: Invalid header name: "+name);
        return false;
      }
      else {
        if (typeof(value) != "undefined") {
          // Set header value
          this.__woff_header[name] = this._to_bytes(value, this.__SPEC.header[name]);
          return true;
        }
        else {
          // Get header value
          return this._from_bytes(this.__woff_header[name], this.__SPEC.header[name]);
        }
      }
    }
    else {
      return this.__woff_header; // TODO: convert byte-array to value.
    }
  };

  /**
   * Create Binary WOFF data.
   *
   * @public
   */
  WOFF.prototype.create = function(){
    // Calculating offset of each font table.

    // Calculating checksum of each font table.

    // Rewrite header values.

    // Calculating checksum of entire table.

    // Packing. (header, table_dirs => ByteArray, font_tables => ByteString)
  };

  /**
   * WOFFGlitch class.
   *
   * @class
   */
  function WOFFGlitch(api_url){
    this._loaded  = [];
    this._API_URL = api_url || '//fonts.googleapis.com/css';
    this._STYLE   = $('<style id="_woffglitch"></style>');
    this._STYLE.appendTo($('head'));
    // Listeners
    this.EE = new EventEmitter();
    this.EE.on('font_css_loaded',       this.load_woff,      this);
    this.EE.on('font_woff_loaded',      this.glitchers.woff, this);
    this.EE.on('font_glitched',         this.build_font_face,this);
    this.EE.on('font_css_loaded_error', this.error,          this);
    // TODO: Support TTF, OTF.
    // this.EE.on('font_truetype_loaded', this.log.error, this);
    // this.EE.on('font_opentype_loaded', this.log.error, this);
  };

  /**
   * Logger
   *
   * @private
   */
  WOFFGlitch.prototype.log = {
    debug: function(message){
      console.log('[DEBUG] WOFFGlitch: '+message);
    },
    error: function(message){
      console.error('[ERROR] WOFFGlitch: '+message);
    }
  }

  WOFFGlitch.prototype._data_scheme = function(raw, format){
    var media_type = '';
    switch (format) {
      case 'truetype':
        media_type = 'application/x-font-ttf';
      break;
      case 'woff':
        media_type = 'application/font-woff';
      break;
      case 'opentype':
        media_type = 'application/vnd.ms-fontobject';
      break;
      default:
        this.log.error('_data_scheme: unsupported format "'+format+"'");
      break;
    };
    return "url('data:" + media_type + ";base64," + Base64.toBase64(raw) + "')";
  };

  /**
   * Build font-face, insert font-face as a style element.
   *
   * @private
   */
  WOFFGlitch.prototype.build_font_face = function(b64, font){
    var font_face   = font.original_css.replace(/url\(.+?\)/, this._data_scheme(b64, font.format));
    // Replace url with data scheme.
    this.log.debug(font_face);
    // Insert font-face as style tag
    $('<style></style>').text(font_face).appendTo($('head'));
  };

  /*
   * @namespace
   **/
  WOFFGlitch.prototype.glitchers = {};

  /**
   * Glitch .woff fonts.
   *
   * @public
   * @param {String} Raw WOFF data (binary string).
   */
  WOFFGlitch.prototype.glitchers.woff = function(raw, font){
    this.log.debug('glitch start.');
    var woff      = new WOFF(raw);
    var table_dir = woff.table_dir_by_tag('glyf');
    var binary    = woff.font_table(table_dir.index);

    woff.font_table(table_dir.index)
        .on('inflated_table',
            function(table_data){
              var table_data = table_data.replace(/0/, 1);
              var that = this;
              setTimeout(function(){
                that.font_table(table_dir.index, table_data);
              }, 0);
            });
  };

  /**
   * Parse @font-face, then load font with ajax.
   *
   * @public
   * @param {String} @font-face text.
   */
  WOFFGlitch.prototype.load_woff = function(data) {
    var font = {};
    var pattern = {
      family: /\s*font-family:\s+?'(.+?)';/,
      url   : /,\s*url\('(.+?)'\)/,
      format: /format\('(.+?)'\)/
    };

    // Parsing Font Family
    if (pattern.family.test(data)) {
      var found_family = data.match(pattern.family);
      font.family = found_family[1];
      this.log.debug('family: '+font.family);

      // Parsing font URL
      if (pattern.url.test(data)){
        var found_url = data.match(pattern.url);
        font.url          = found_url[1];
        font.original_css = data;
        this.log.debug('url: '+font.url);

        // Parsing format
        if (pattern.format.test(data)) {
          var found_format = data.match(pattern.format);
          font.format = found_format[1];
          this.log.debug('format: '+font.format);

          // Load font with AJAX.
          // FIXME: depend on jQuery. Rewrite with plain XHR
          $.ajax(font.url, {
            beforeSend: function(xhr){
              xhr.overrideMimeType("text/plain; charset=x-user-defined");
            },
            context: this,
            complete: function(xhr) {
              console.log(xhr.response);
            },
            success: function(data, status, xhr){
              this.EE.emit('font_'+font.format+'_loaded', data, font);
            }
          });
        }
        else {
          this.log.error('Failed to parse @font-face (Font format)');
        }
      }
      else {
        this.log.error('Failed to parse @font-face (Font url)');
      }
    }
    else {
      this.log.error('Failed to parse @font-face (Font url)');
    }
  }

  /**
   * Load glitched webfont.
   *
   * @public
   * @param {String} family Family name of WebFont.
   */
  WOFFGlitch.prototype.load = function(family){
    var protocol = 'https:' == window.location.protocol ? 'https:' : 'http:';
    var font_url = protocol + this._API_URL + '?family=' + family;
    $.ajax(font_url, {
      context: this,
      success: function(data){ this.EE.emit('font_css_loaded', data); },
      error: function(status){ this.EE.emit('error', status); }
    });
  }

  /**
   * Load Multiple fonts at once.
   *
   * @public
   * @param {Array} families An Array of family names.
   */
  WOFFGlitch.prototype.load_fonts = function(families){
    for (var family in families) {
      this.load(families[family]);
    }
  };

  // Export
	if(typeof define === 'function' && define.amd) {
		define(function() { return WOFFGlitch; });
	}
	else {
		exports.WOFFGlitch = WOFFGlitch;
	}
})(this);
