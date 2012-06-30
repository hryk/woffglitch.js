(function($){
  var insert_fontface = function(raw){
    // Glitch raw data.
    var b64 = Base64.toBase64(raw);
    if (b64 == woff_b64){
      console.log('correct');
    }
    else {
      console.log('not identical');
      console.log(woff_b64);
      console.log(b64);
    }
    var data_scheme = "url('data:application/x-font-woff;base64,"+b64+"')";
    var font_face = "@font-face {\n"+
      "font-family: 'Audiowide';\n"+
      "font-style: normal;\n"+
      "font-weight: 400;\n"+
      "src: local('Audiowide'), local('Audiowide-Regular'), "+data_scheme+" format('woff');\n"+
      "}";
    $('<style></style>').text(font_face).appendTo($('head'));
    $('h1').css('font-family', "'Audiowide'");
  };
  $(function(){
    // base64 data : woff_b64   
    var woffdata = Base64.fromBase64(woff_b64);
    insert_fontface(woffdata);
  });
})(jQuery);
