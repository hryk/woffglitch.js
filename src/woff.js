(function(exports){
  'use strict';

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
  }

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
      flavor          : "uint32",
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
    }
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
      signature       : BinUtil.read_bytes(this.__data, current, 4),
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
      flavor          : BinUtil.read_bytes(this.__data, (current+=4), 4),
      length          : BinUtil.read_bytes(this.__data, (current+=4), 4),
      num_tables      : BinUtil.read_bytes(this.__data, (current+=4), 2),
      reserved        : BinUtil.read_bytes(this.__data, (current+=2), 2),
      // totalSfntSize:
      //  Total size needed for the uncompressed font data,
      //  including the sfnt header, directory, and font tables
      total_sfnt_size : BinUtil.read_bytes(this.__data, (current+=2), 4),
      major_version   : BinUtil.read_bytes(this.__data, (current+=4), 2),
      minor_version   : BinUtil.read_bytes(this.__data, (current+=2), 2),
      meta_offset     : BinUtil.read_bytes(this.__data, (current+=2), 4),
      meta_length     : BinUtil.read_bytes(this.__data, (current+=4), 4),
      meta_org_length : BinUtil.read_bytes(this.__data, (current+=4), 4),
      priv_offset     : BinUtil.read_bytes(this.__data, (current+=4), 4),
      priv_length     : BinUtil.read_bytes(this.__data, (current+=4), 4)
    };
    console.log('current position: '+current);
    console.log("sig: "+        BinUtil.bytes_to_string(this.__woff_header.signature));
    console.log("flavor: "+     BinUtil.bytes_to_uint32(this.__woff_header.flavor));
    console.log("length: "+     BinUtil.bytes_to_uint32(this.__woff_header.length));
    console.log("tables: "+     BinUtil.bytes_to_uint16(this.__woff_header.num_tables));
    console.log("sfnt_size: "+  BinUtil.bytes_to_uint32(this.__woff_header.total_sfnt_size));
    console.log("major v: "+    BinUtil.bytes_to_uint16(this.__woff_header.major_version));
    console.log("minor v: "+    BinUtil.bytes_to_uint16(this.__woff_header.minor_version));
    console.log("meta offset: "+BinUtil.bytes_to_uint32(this.__woff_header.meta_offset));
    console.log("meta length: "+BinUtil.bytes_to_uint32(this.__woff_header.meta_length));
    console.log("priv offset: "+BinUtil.bytes_to_uint32(this.__woff_header.priv_offset));
    console.log("priv length: "+BinUtil.bytes_to_uint32(this.__woff_header.priv_length));
    // Reading table directories.
    this.__table_dirs = [];
    var num_tables    = BinUtil.bytes_to_uint16(this.__woff_header.num_tables);
    for (var i=0; i < num_tables;i++) {
      current += 4;
      this.__table_dirs.push({
        index: i,
        tag:           BinUtil.read_bytes(this.__data, current,      4),
        offset:        BinUtil.read_bytes(this.__data, (current+=4), 4),
        comp_length:   BinUtil.read_bytes(this.__data, (current+=4), 4),
        orig_length:   BinUtil.read_bytes(this.__data, (current+=4), 4),
        orig_checksum: BinUtil.read_bytes(this.__data, (current+=4), 4)
      });
      console.log("---------------------------------------------");
      console.log("tag: "+          BinUtil.bytes_to_string(this.__table_dirs[i].tag));
      console.log("offset: "+       BinUtil.bytes_to_uint32(this.__table_dirs[i].offset));
      console.log("comp_len: "+     BinUtil.bytes_to_uint32(this.__table_dirs[i].comp_length));
      console.log("orig_len: "+     BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length));
      console.log("orig_checksum: "+BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_checksum));
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
    for (var dir_index in this.__table_dirs) {
      if (BinUtil.bytes_to_string(this.__table_dirs[dir_index].tag) === tag) {
        table = this.table_dir(dir_index);
        break;
      }
    }
    return table;
  };

  /**
   * Return Array of converted table directories.
   *
   * @public
   * @return {Array} table directories sorted by index.
   */
  WOFF.prototype.table_dirs = function(){
    var num_tables = BinUtil.bytes_to_uint16(this.__woff_header.num_tables),
        tables     = [];
    for (var i=0; i<num_tables; i++) {
      tables.push(this.table_dir(i));
    }
    return tables;
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
    var new_dir = {},
        dir     = this.__table_dirs[index];
    new_dir.index = dir.index;
    for (var key in dir) {
      if (key != 'index')
        new_dir[key] = BinUtil.bytes_to(this.__SPEC.table_dir[key], dir[key]);
    }
    return new_dir;
  };

  // TTF Checksum.
  // https://developer.apple.com/fonts/TTRefMan/RM06/Chap6.html
  WOFF.prototype._calc_table_checksum = function(str) {
    console.log('calculating checksum');
    var table = BinUtil.read_bytes(str); // <- TODO: string. retrieve as uint32.
    var number_of_bytes_in_table = table.length*2,
        sum     = 0,
        nlongs  = Math.round((number_of_bytes_in_table + 3) / 4);
    console.log('number_of_bytes_in_table:'+ number_of_bytes_in_table );
    console.log('nlongs:'+ nlongs);
    var j = 0;
    console.log(table);
    while(nlongs -= 1 > 0){
      var b0 = (typeof(table[j])   !== 'undefined') ? table[j]   : 0,
          b1 = (typeof(table[j+1]) !== 'undefined') ? table[j+1] : 0,
          b2 = (typeof(table[j+2]) !== 'undefined') ? table[j+2] : 0;
      sum += BinUtil.bytes_to_uint32([b0, b1, b2, 0]);
      j+=1;
    }
    console.log('sum: '+sum);
    return sum;
  };

  /*
   * uint32 CalcTableChecksum(uint32 *table, uint32 numberOfBytesInTable)
   *     {
   *      uint32 sum = 0;
   *      uint32 nLongs = (numberOfBytesInTable + 3) / 4;
   *
   *      while (nLongs-- > 0)
   *        sum += *table++;
   *
   *      return sum;
   *     }
   */

  WOFF.prototype._set_uncompressed_font_table = function(index, value) {
    if (typeof(value) === 'object') value = BinUtil.bytes_to_string(value);
    var that     = this,
        checksum = this._calc_table_checksum(value);
    console.log(checksum);
    // 先頭4byteがパディングの場合かつパディングが無い場合、パディングを付加する(4byte 0)
    setTimeout(function(){
      that.__table_dirs[index].orig_checksum = checksum;
      that.__table_dirs[index].comp_length   = value.length;
      that.__table_dirs[index].orig_length   = value.length;
      that.__font_tables[index]              = value;
    }, 0);
  };

  // WOFF.prototype._set_compressed_font_table = function(index, value) {
  //   if (typeof(value) === 'object')
  //    value = this._b_to_str(value);
  //   var that = this;
  //   setTimeout(function(){
  //     that.__font_tables[index]            = comp_value;
  //     that.__table_dirs[index].comp_length = comp_value.length;
  //     that.__table_dirs[index].orig_length = value.length;
  //     var checksum = that._calc_checksum(value);
  //     setTimeout(function(){
  //       that.__table_dirs[index].orig_checksum = checksum;
  //     }, 0);
  //   },0);
  // };

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
      var that       = this;
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
    if (typeof(index) === "undefined") {
      throw new Error("WOFF.font_table: index is missing");
    }
    else {
      var set = true;
      if (typeof(value) === "undefined") set = false;
      // Uncompressed Font table.
      if (table_info.comp_len === table_info.orig_len) {
        if (set) {
          this._set_uncompressed_font_table(index, value);
        }
        else {
          this._get_uncompressed_font_table(index);
        }
      }
      // Compressed Font table.
      else {
        if (set) {
          // 6. Font Data Tables
          //
          // The font data tables in the WOFF file are exactly the same as the
          // tables in the input font, except that each table **MAY** have been
          // compressed.
          //
          this._set_uncompressed_font_table(index, value);
        }
        else {
          this._get_compressed_font_table(index);
        }
      }
      return this;
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
        throw new Error("WOFF.header: Invalid header name: "+name);
      }
      else {
        var value_type = this.__SPEC.header[name];

        if (typeof(value) != "undefined") {
          // Set header value
          this.__woff_header[name] = BinUtil.bytes_from(value_type, value);
          return true;
        }
        else {
          // Get header value
          return BinUtil.bytes_to(value_type, this.__woff_header[name]);
        }
      }
    }
    else {
      // Return all headers.
      return this.__woff_header; // TODO: convert byte-array to value.
    }
  };

  /**
   * Create Binary WOFF data.
   *
   * @public
   */
  WOFF.prototype.create = function(){
    throw new Error("WOFF.create have not been implemented yet.");
    // Calculating offset of each font table.

    // Calculating checksum of each font table.

    // Rewrite header values.

    // Calculating checksum of entire table.

    // Packing. (header, table_dirs => ByteArray, font_tables => ByteString)
  };

  // Export
	if(typeof define === 'function' && define.amd) {
    define(function() { return WOFF; });
	}
	else {
		exports.WOFF = WOFF;
	}
})(this);
