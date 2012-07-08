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

  it("should be able to return table by name", function(){

  });

  it("should be able to return tables", function(){

  });

});
