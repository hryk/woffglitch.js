describe("WOFF", function(){
  var raw_woff = Base64.fromBase64(woff_b64),
      woff;

  beforeEach(function(){
    woff = new WOFF(raw_woff);
  });

  it("should be able to parse raw woff", function(){
    expect(woff.header("signature")).toEqual('wOFF');
    expect(woff.header("flavor")).toEqual(65536);
    expect(woff.header("num_tables")).toEqual(13);
    expect(woff.header("total_sfnt_size")).toEqual(46220);
  });

  it("should be able to return tables", function(){
    var table = woff.table_dir(0);
    expect(table.tag).toEqual("FFTM");
  });

  it("should be able to return table by name", function(){
    var kern_table = woff.table_dir_by_tag("kern");
    expect(kern_table.offset).toEqual(11212);
  });

  it("should calculate length correctly", function(){
    var all_table = woff.table_dirs();
    for (var table_index in all_table) {
      var original_length = all_table[table_index].orig_length,
          table_data        = woff.font_table(table_index);
      var length = table_data.length;
      expect(length).toEqual(original_length);
    }
  });

  it("should calculate checksum correctly", function(){
    var original_checksum, table_data, checksum;
    var all_table = woff.table_dirs();
    for (var table_index in all_table) {
      if (all_table[table_index].tag !== 'head') {
        original_checksum = all_table[table_index].orig_checksum;
        table_data        = woff.font_table(table_index);
        checksum = woff._calc_table_checksum(table_data);
        expect(checksum).toEqual(original_checksum);
      }
      else {
        // head table
        table_data        = woff.font_table(table_index);
        original_checksum = all_table[table_index].orig_checksum;
        checksum = woff._calc_table_checksum(table_data, true);
        expect(checksum).toEqual(original_checksum);
      }
    }
  });
});
