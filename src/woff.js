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
    this._modified      = false;
    this.__parsed = false;
    this._parse_header();
    this._parse_font_tables();
    // EventEmitter
    this._events = {};
		this._maxListeners = 10;
    this.on('woff_parsed', this._update_table_offset);
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
  WOFF.prototype._parse_header = function(){
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
    // Reading table directories.
    this.__table_dirs = [];
    var num_tables    = BinUtil.bytes_to_uint16(this.__woff_header.num_tables);
    for (var i=0; i < num_tables;i++) {
      current += 4;
      this.__table_dirs.push({
        index:         i,
        tag:           BinUtil.read_bytes(this.__data, current,      4),
        offset:        BinUtil.read_bytes(this.__data, (current+=4), 4),
        comp_length:   BinUtil.read_bytes(this.__data, (current+=4), 4),
        orig_length:   BinUtil.read_bytes(this.__data, (current+=4), 4),
        orig_checksum: BinUtil.read_bytes(this.__data, (current+=4), 4)
      });
    }
  };

  /**
   * Show font data in console.log.
   *
   * @public
   *
   */
  WOFF.prototype.inspect = function(){
    console.log("======== WOFF Inspection =========");
    // show WOFF header info
    console.log("sig: "+          BinUtil.bytes_to_string(this.__woff_header.signature));
    console.log("flavor: "+       BinUtil.bytes_to_uint32(this.__woff_header.flavor));
    console.log("length: "+       BinUtil.bytes_to_uint32(this.__woff_header.length));
    console.log("tables: "+       BinUtil.bytes_to_uint16(this.__woff_header.num_tables));
    console.log("sfnt_size: "+    BinUtil.bytes_to_uint32(this.__woff_header.total_sfnt_size));
    console.log("major v: "+      BinUtil.bytes_to_uint16(this.__woff_header.major_version));
    console.log("minor v: "+      BinUtil.bytes_to_uint16(this.__woff_header.minor_version));
    console.log("meta offset: " + BinUtil.bytes_to_uint32(this.__woff_header.meta_offset));
    console.log("meta length: " + BinUtil.bytes_to_uint32(this.__woff_header.meta_length));
    console.log("priv offset: " + BinUtil.bytes_to_uint32(this.__woff_header.priv_offset));
    console.log("priv length: " + BinUtil.bytes_to_uint32(this.__woff_header.priv_length));
    // show font table dir info
    for (var i=0;i<this.__table_dirs.length;i++) {
      console.log("---------------------------------------------");
      console.log("tag: "+          BinUtil.bytes_to_string(this.__table_dirs[i].tag));
      console.log("offset: "+       BinUtil.bytes_to_uint32(this.__table_dirs[i].offset));
      console.log("comp_len: "+     BinUtil.bytes_to_uint32(this.__table_dirs[i].comp_length));
      console.log("orig_len: "+     BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length));
      console.log("orig_checksum: "+BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_checksum));
    }
    console.log("======== END =========");
  };

  WOFF.prototype._check_uncompressed = function(){
    var num_tables = BinUtil.bytes_to_uint16(this.__woff_header.num_tables);
    var table_info;
    var uncompressed = true;
    for (var i=0; i<this.__table_dirs.length; i++) {
      table_info = this.table_dir(i);
      if (table_info.comp_length !== table_info.orig_length)
        uncompressed = false;
    }
    if (uncompressed) {
      this.__parsed = true;
      clearInterval(this.__parse_check);
    }
    this.emit('woff_parsed', this);
  };

  /**
   * Populate font tables.
   *
   * @private
   *
   */
  WOFF.prototype._parse_font_tables = function(){
    var raw, font_table_dir;
    var num_tables = BinUtil.bytes_to_uint16(this.__woff_header.num_tables);
    // Get raw data.
    for (var i=0; i<this.__table_dirs.length; i++) {
      font_table_dir = this.table_dir(i);
      if (font_table_dir.comp_length !== font_table_dir.orig_length) {
        this._uncompress_font_table(i);
      }
      else {
        this.__font_tables[i] = this._get_uncompressed_font_table(i);
      }
    }
    var that = this;
    this.__parse_check = setInterval(function(){ that._check_uncompressed(); }, 10);
    return this;
  };

  /**
   * Update WOFF Header
   *
   * TODO
   *
   * @private
   *
   */
  WOFF.prototype._update_header = function(){
    // update length
    // WOFF header + table dir + font table + (ExtendedMetadata + PrivateData)
    // update total_sfnt_size
    // WOFF header + table dir + font table (uncompressed) + (ExtendedMetadata + PrivateData)
    // Total size needed for the uncompressed font data, including the sfnt
    // header, directory, and font tables (including padding).
    var woff_length     = 44 + (this.__table_dirs.length * 16);
    var total_sfnt_size = 12 + (this.__table_dirs.length * 16) + 4;

    for (var i=0;i<this.__table_dirs.length;i++) {
      woff_length += BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length);
      var pad = (BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length)) % 4;
      if (pad !== 0) {
        total_sfnt_size += BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length) + pad;
      }
      else {
        total_sfnt_size += BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_length);
      }
    }

    console.log("length: "   +woff_length);
    console.log("sfnt_size: "+total_sfnt_size);
    this.__woff_header.length          = BinUtil.uint32_to_bytes(woff_length);
    this.__woff_header.total_sfnt_size = BinUtil.uint32_to_bytes(total_sfnt_size);
  };

  /**
   * Update offset of font tables.
   *
   * TODO
   *
   * @private
   *
   */
  WOFF.prototype._update_table_offsets = function(){
    var table_dir;
    for (var i=0;i < this.__table_dirs.length;i++) {
      table_dir = this.__table_dirs[i];
      console.log("---------"+ BinUtil.bytes_to_string(this.__table_dirs[i].tag) +"----------");
      console.log("original offset:   " + BinUtil.bytes_to_uint32(this.__table_dirs[i].offset));
      console.log("calculated offset: " + this._get_table_offsets(i, true));
    }
  };

  /**
   * culculate padding length of table has given index.
   *
   * @private
   */
  WOFF.prototype._calc_table_padding_length = function(index){
    var length = BinUtil.bytes_to_uint32(this.__table_dirs[index].orig_length);
    if (length % 4 !== 0) {
      return 4 - (length % 4);
    }
    else {
      return 0;
    }
  };

  /**
   * get table offset from current data.
   *
   * TODO
   *
   * @private
   *
   */
  WOFF.prototype._get_table_offsets = function(index, padded){
    var offset = 0;
    for (var i=0;i <= index;i++) {
      if (i === 0) {
        offset = BinUtil.bytes_to_uint32(this.__table_dirs[i].offset);
      }
      else {
        offset += BinUtil.bytes_to_uint32(this.__table_dirs[i-1].orig_length);
      }
    }
    if (typeof(padded) !== "undefined" && padded === true) {
      var pad = offset % 4;
      if (pad !== 0) offset = offset + 4 - pad;
    }
    return offset;
  };

  WOFF.prototype._calc_checksum_adjustment = function(){
    // * Set the head table's checkSumAdjustment to 0.
    var head_table      = this.table_dir_by_tag('head');
    var head_table_data = this.font_table(head_table.index);

    // * Calculate the checksum for all the tables including the 'head' table and

    // * enter that value into the table directory.

    // * Calculate the checksum for the entire font.

    // * Subtract that value from the hex value B1B0AFBA.
    // * Store the result in checkSumAdjustment.
  };

  /**
   * Create Binary WOFF data.
   *
   * TODO
   *
   * @public
   * @return ByteArray
   */
  WOFF.prototype.create = function(){
    var font_array = [];
    var tmp_offset, tmp_table_data, is_head_table;

    // Calculating offset of each font table.
    //
    // - offset
    //
    this._update_table_offsets();

    // Update woff header values.
    //
    // - length
    // - total_sfnt_size
    //
    this._update_header();

    // Calculating checksum of entire table.
    //  => Update 'head' table's checkSumAdjustment.
    //
    // this._calc_checksum_adjustment();

    // WOFF Header.
    font_array = font_array.concat(this.__woff_header["signature"]);
    font_array = font_array.concat(this.__woff_header["flavor"]);
    // length -> update
    font_array = font_array.concat(this.__woff_header["length"]);
    font_array = font_array.concat(this.__woff_header["num_tables"]);
    font_array = font_array.concat(this.__woff_header["reserved"]);
    // total_sfnt_size -> update
    font_array = font_array.concat(this.__woff_header["total_sfnt_size"]);
    font_array = font_array.concat(this.__woff_header["major_version"]);
    font_array = font_array.concat(this.__woff_header["minor_version"]);
    font_array = font_array.concat(this.__woff_header["meta_offset"]);
    font_array = font_array.concat(this.__woff_header["meta_length"]);
    font_array = font_array.concat(this.__woff_header["meta_org_length"]);
    font_array = font_array.concat(this.__woff_header["priv_offset"]);
    font_array = font_array.concat(this.__woff_header["priv_length"]);

    var table_data, pad, pad_count, tmp_offset_padded;

    // Font Table Dirs.
    for (var i=0; i < this.__table_dirs.length;i++) {
      tmp_offset     = this._get_table_offsets(i);
      tmp_offset_padded = this._get_table_offsets(this.__table_dirs[i].index, true);
      tmp_table_data = this.font_table(this.__table_dirs[i].index);
      if (tmp_offset % 4 !== 0) {
        console.log("Add padding to "+BinUtil.bytes_to_string(this.__table_dirs[i].tag));
        pad_count = tmp_offset_padded - tmp_offset;
        for (var k=0;k<pad_count;k++) {
          tmp_table_data = tmp_table_data.concat([0x00]);
        }
      }
      is_head_table  = (BinUtil.bytes_to_string(this.__table_dirs[i].tag) === 'head') ? true : false;
      console.log(BinUtil.bytes_to_string(this.__table_dirs[i].tag)+": "+tmp_offset_padded+": "+tmp_offset);

      font_array = font_array.concat(this.__table_dirs[i].tag);
      font_array = font_array.concat(BinUtil.uint32_to_bytes(tmp_offset_padded));
      font_array = font_array.concat(this.__table_dirs[i].orig_length);
      font_array = font_array.concat(this.__table_dirs[i].orig_length);

      // Checksumが合わない！
      var chksum = this._calc_table_checksum(tmp_table_data, is_head_table);

      console.log(BinUtil.bytes_to_string(this.__table_dirs[i].tag)+"("+
                  BinUtil.bytes_to_uint32(this.__table_dirs[i].orig_checksum)+"): "+chksum);

      font_array = font_array.concat(BinUtil.uint32_to_bytes(chksum));
    }

    table_data = null;
    pad = 0;
    pad_count = 0;
    tmp_offset_padded = 0;

    for (var j=0; j < this.__table_dirs.length;j++) {
      table_data = this.font_table(this.__table_dirs[j].index);
      tmp_offset = this._get_table_offsets(this.__table_dirs[j].index);
      font_array = font_array.concat(
        BinUtil.read_bytes(this.font_table(this.__table_dirs[j].index)));
      if (tmp_offset % 4 !== 0) {
        tmp_offset_padded = this._get_table_offsets(this.__table_dirs[j].index, true);
        pad_count = tmp_offset_padded - tmp_offset;
        for (var y=0;y<pad_count;y++) {
          font_array = font_array.concat([0x00]);
        }
      }
    }

    for (var x=0; x < font_array.length; x++) {
      font_array[x] = "0x"+font_array[x].toString(16);
    }

    console.log("font_array size: " + font_array.length + ", header: " +
                BinUtil.bytes_to_uint32(this.__woff_header["length"]));

    return font_array;
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

  WOFF.prototype._update_table_dir = function(index) {
    var table_info = this.table_dir(index);
    var raw_data   = BinUtil.read_bytes(this.__font_tables[index]);
    var is_head_table = false;
    if (table_info.tag === 'head') is_head_table = true;
    var that = this,
    checksum = this._calc_table_checksum(raw_data, is_head_table),
    length   = raw_data.length;
    if (raw_data % 4 !== 0)
      raw_data = this._add_padding_to_data(raw_data);
      setTimeout(function(){
        that.__table_dirs[index].orig_checksum = BinUtil.uint32_to_bytes(checksum);
        that.__table_dirs[index].comp_length   = BinUtil.uint32_to_bytes(length);
        that.__table_dirs[index].orig_length   = BinUtil.uint32_to_bytes(length);
        that.__font_tables[index]              = BinUtil.bytes_to_string(raw_data);
      }, 0);
  };

  WOFF.prototype._uncompress_font_table = function(index) {
    var table_info = this.table_dir(index);
    var offset = table_info.offset;
    if (table_info.index > 0) offset += 2;
    var that         = this;
    var compressed   = this.__data.substr(offset, table_info.comp_length);
    var uncompressed = RawDeflate.inflate(compressed);
    setTimeout(function(){
      that.__font_tables[index] = uncompressed;
      that._update_table_dir(index);
    }, 0);
  };

  WOFF.prototype._add_padding_to_data = function(value){
    if (typeof(value) === 'string')
      value = BinUtil.read_bytes(value);
    var length_padding = 0;
    if (value.length % 4 !== 0) {
      length_padding = 4 - (value.length % 4);
      for (var i=0;i<length_padding;i++) {
        value = value.concat([0x00]);
      }
    }
    return value;
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
  //
  // headだけ別扱い
  //
  // To calculate the checkSum for the 'head' table which itself includes the
  // checkSumAdjustment entry for the entire font, do the following:
  //
  // - Set the checkSumAdjustment to 0.
  // - Calculate the checksum for all the tables including the 'head' table
  //   and enter that value into the table directory.
  // - Calculate the checksum for the entire font.
  // - Subtract that value from the hex value B1B0AFBA.
  // - Store the result in checkSumAdjustment.
  //
  // The checkSum for the 'head table which includes the checkSumAdjustment
  // entry for the entire font is now incorrect. That is not a problem. Do not
  // change it. An application attempting to verify that the 'head' table has
  // not changed should calculate the checkSum for that table by not including
  // the checkSumAdjustment value, and compare the result with the entry in the
  // table directory.
  //

  /**
   * Calculating checksum of font-table.
   *
   * @private
   * @param {String, Array} raw data of font-table.
   * @param {Boolean} Is it 'head' table?
   * @return {Integer} checksum
   */
  WOFF.prototype._calc_table_checksum = function(str, is_head_table) {
    var table;
    if (typeof(is_head_table) === 'undefined')
      is_head_table = false;
    if (typeof(str) === 'string') {
      table = BinUtil.read_bytes(str);
    }
    else {
      table = str
    }
    var number_of_bytes_in_table = table.length*2,
        sum     = 0,
        nlongs  = Math.floor((number_of_bytes_in_table + 3) / 4);
    var j = 0;
    var b0, b1, b2, b3, uint;
    while (nlongs -= 1 > 0) {
     if (typeof(table[j]) === 'undefined') break;
     if (!(is_head_table && j == 8)) {
       // skip checkSumAdjustment of head table.
       b0 = (typeof(table[j])   !== 'undefined') ? table[j]   : 0;
       b1 = (typeof(table[j+1]) !== 'undefined') ? table[j+1] : 0;
       b2 = (typeof(table[j+2]) !== 'undefined') ? table[j+2] : 0;
       b3 = (typeof(table[j+3]) !== 'undefined') ? table[j+3] : 0;

       uint = BinUtil.bytes_to_uint32([b0, b1, b2, b3]);

       sum += uint;
       if (sum > Math.pow(2, 32)) {
         sum = sum - Math.pow(2, 32);
       }
     }
      j+=4;
    }
    return sum;
  };

  /**
   * Set WOFF header data (uncompressed).
   *
   * @private
   * @param {Integer} index of font-table.
   * @param {String} raw data of font-table to set.
   */
  WOFF.prototype._set_uncompressed_font_table = function(index, value) {
    if (typeof(value) === 'object') value = BinUtil.bytes_to_string(value);
    var is_head_table = false;
    if (BinUtil.bytes_to_string(this.__table_dirs[index].tag) === 'head')
      is_head_table = true;
    var that = this,
    checksum = this._calc_table_checksum(value, is_head_table);
    // 先頭4byteがパディングの場合かつパディングが無い場合、パディングを付加する(4byte 0)
    if (value.length % 4 !== 0) {
      value = this._add_padding_to_data(value);
    }
    setTimeout(function(){
      that.__table_dirs[index].orig_checksum = BinUtil.uint32_to_bytes(checksum);
      that.__table_dirs[index].comp_length   = BinUtil.uint32_to_bytes(value.length);
      that.__table_dirs[index].orig_length   = BinUtil.uint32_to_bytes(value.length);
      that.__font_tables[index]              = value;
    }, 0);
  };

  /**
   * Get WOFF header data which is not compressed.
   *
   * @private
   * @param {Integer} index of font-table.
   * @return {String} font data.
   */
  WOFF.prototype._get_uncompressed_font_table = function(index) {
    var table_info = this.table_dir(index);

    if (typeof(this.__font_tables[index]) === "undefined")
      this.__font_tables[index] = this.__data.substr(table_info.offset,
                                                     table_info.orig_length);
    return this.__font_tables[index];
  };

  /**
   * Get compressed WOFF header data.
   *
   * @private
   * @param {Integer} index of font-table.
   * @return {String} uncompressed font data.
   */
  WOFF.prototype._get_compressed_font_table = function(index) {
    var table_info = this.table_dir(index);
    if (typeof(this.__font_tables[index]) === "undefined") {
      //
      // The OpenType/OFF specification is not entirely clear about whether all
      // tables in an sfnt font must be padded with 0-3 zero bytes to a
      // multiple of 4 bytes in length, or whether this applies only between
      // tables, and the final table of the file may be left unpadded.
      //
      var offset = table_info.offset;
      if (table_info.index > 0) offset += 2;
      var compressed = this.__data.substr(offset, table_info.comp_length);
      this._set_uncompressed_font_table(index, RawDeflate.inflate(compressed));
      var that       = this;
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
      throw new Error("WOFF.font_table: index is missing.");
    }
    else {
      var set = true;
      if (typeof(value) === "undefined") set = false;
      // Uncompressed Font table.
      if (BinUtil.bytes_to_uint32(table_info.comp_length) ===
          BinUtil.bytes_to_uint32(table_info.orig_length)) {
        if (set) {
          this._set_uncompressed_font_table(index, value);
          return this;
        }
        else {
          return this._get_uncompressed_font_table(index);
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
          return this;
        }
        else {
          return this._get_compressed_font_table(index);
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


  // Export
	if(typeof define === 'function' && define.amd) {
    define(function() { return WOFF; });
	}
	else {
		exports.WOFF = WOFF;
	}
})(this);
