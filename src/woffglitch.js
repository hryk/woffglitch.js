// TODO: Embbed LICENSE.
//
// Dependencies : base64.js, EventEmitter.js, jQuery.js, rawdeflate.js, rawinflate.js
//
(function(exports){
  'use strict';

  // http://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html

  function encode_utf8( s ) {
    return unescape( encodeURIComponent( s ) );
  }

  function decode_utf8( s ) {
    return decodeURIComponent( escape( s ) );
  }

  /**
   * WOFFGlitch class.
   *
   * @class
   */
  function WOFFGlitch(api_url){
    this._loaded  = [];
    this._API_URL = api_url || '//fonts.googleapis.com/css';
    // Listeners
    this.on('font_css_loaded',       this.load_font_from_css);
    this.on('font_direct_loaded',    this.load_font);
    this.on('font_css_loaded_error', this.error);
    this.on('font_woff_loaded',      this.glitchers.woff);
    this.on('font_glitched',         this.build_font_face);
    // TODO: Support TTF, OTF.
    // this.on('font_truetype_loaded', this.log.error, this);
    // this.on('font_opentype_loaded', this.log.error, this);
  }

  WOFFGlitch.prototype = EventEmitter.prototype;

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
  };

  /**
   * Return data scheme of font.
   *
   * @private
   */
  WOFFGlitch.prototype._data_scheme = function(raw, format){
    var media_type = '';
    switch (format) {
      case 'truetype':
        media_type = 'application/x-font-ttf';
      break;
      case 'woff':
        media_type = 'application/x-font-woff';
      break;
      case 'opentype':
        media_type = 'application/vnd.ms-fontobject';
      break;
      default:
        this.log.error('_data_scheme: unsupported format "'+format+"'");
      break;
    }
    var b64 = btoa(String.fromCharCode.apply(null, raw));
    // return "url('data:" + media_type + ";base64," + b64 + "')";
    return "data:" + media_type + ";base64," + b64 + "";
  };

  /**
   * Build font-face, insert font-face as a style element.
   *
   * @private
   * @param {Array} raw raw font data.
   * @param {Object} font font struct.
   *
   * @font-face {
   *   font-family: 'Audiowide';
   *   font-style: normal;
   *   font-weight: 400;
   *   src: local('Audiowide'), local('Audiowide-Regular'),
   *   url(http://themes.googleusercontent.com/static/fonts/audiowide/v1/8XtYtNKEyyZh481XVWfVOrO3LdcAZYWl9Si6vvxL-qU.woff)
   *   format('woff');
   *  }
   *
   */
  WOFFGlitch.prototype.build_font_face = function(raw, font){
    var family    = this.font_family;
    var font_face = font.original_css.
      replace(/url\(.+?\)/,"url('"+this._data_scheme(raw, font.format)+"')");
    var that = this;
    $("<style></style>").text(font_face).appendTo($("head"));
    setTimeout(function(){
      $("body").css('font-family', family);
      that.emit('woffglitch_callback', raw, family, font.format);
    }, 0);
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
    var woff       = new WOFF(raw);
    var that = this;
    woff.once("woff_ready", function(){
      var table_dir  = woff.table_dir_by_tag('hmtx');
      var table_data = woff.font_table(table_dir.index);
      var table_data_array = BinUtil.read_bytes(table_data);
      for (var i=0;i<table_data_array.length;i++) {
        if (parseInt(table_data_array[i], 16) > 10 && parseInt( Math.random()*10) > 2) {
          table_data_array[i] = "d".toString(16) //parseInt(Math.random()*256).toString(16);
        }
      }
      for (var i=0;i<table_data_array.length;i++) {
        if (parseInt(table_data_array[i], 16) < 7  && parseInt( Math.random()*10) > 5) {
          table_data_array[i] = parseInt(Math.random()*-200).toString(16);
        }
      }
      table_data = BinUtil.bytes_to_string(table_data_array);
      // Glyf
      var glyf_table_dir  = woff.table_dir_by_tag('glyf');
      var glyf_array = BinUtil.read_bytes(woff.font_table(glyf_table_dir.index));
      for (var i=0;i<glyf_array.length;i++) {
        if (
            parseInt(glyf_array[i], 16) > 190 &&
            parseInt(glyf_array[i], 16) < 250 &&
            parseInt( Math.random()*10) > 1) {
          glyf_array[i] = (parseInt(glyf_array[i], 16) * Math.random() * 1000).toString(16);
          glyf_array[i] = (Math.random() * -20000).toString(16);
          glyf_array[i] = (parseInt(glyf_array[i], 16) * parseInt(glyf_array[i+1], 16)).toString(16);
          glyf_array[i] = (parseInt(glyf_array[i-1], 16) * parseInt(glyf_array[i], 16)).toString(16);
        }
      }
      setTimeout(function(){
        woff.font_table(table_dir.index, table_data);
        woff.font_table(glyf_table_dir.index, BinUtil.bytes_to_string(glyf_array));
        var font_array = woff.create();
        setTimeout(function(){
          that.emit('font_glitched',font_array ,font);
        }, 0);
      }, 0);
    });
  };

  // WOFFGlitch.prototype.load_font = function(data) {
  //   var font = {
  //     'family': this.family,
  //     'url':
  //   };
  // };

  /**
   * Parse @font-face, then load font with ajax.
   *
   * @public
   * @param {String} @font-face text.
   */
  WOFFGlitch.prototype.load_font_from_css = function(data) {
    var font = {
      'family': '',
      'original_css': '',
      'format': ''
    };
    var pattern = {
      family: /\s*font-family:\s+?'(.+?)';/,
      url   : /,\s*url\('*(.+?)'*\)/,
      format: /format\('*(.+?)'*\)/
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
          // FIXME: depends on jQuery. Rewrite with plain XHR
          $.ajax(font.url, {
            beforeSend: function(xhr){
              xhr.overrideMimeType("text/plain; charset=x-user-defined");
            },
            context: this,
            success: function(data, status, xhr){
              this.emit('font_'+font.format+'_loaded', data, font);
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
  };

  /**
   * Load glitched webfont.
   *
   * @public
   * @param {String} family Family name of WebFont.
   */
  WOFFGlitch.prototype.load = function(family, callback){
    var protocol, font_url, capture, mode;

    if (/\.(ttf|woff)$/.test(family)) {
      font_url = family;
      capture  = /.*\/(.+?)\.(ttf|woff)$/.exec(font_url);
      family   = capture[1];
      mode     = 'direct';
    }
    else {
      protocol = 'https:' == window.location.protocol ? 'https:' : 'http:';
      font_url = protocol + this._API_URL + '?family=' + family;
      mode     = 'css';
    }

    this.font_family = family;

    if (typeof(callback) !== 'undefined')
      this.on('woffglitch_callback', callback, this);

    $.ajax(font_url, {
      context: this,
      success: function(data) { this.emit('font_'+mode+'_loaded', data); },
      error:   function(status){ this.emit('error', status); }
    });
  };

  /**
   * Get glitched webfont.
   *
   * @public
   * @param {String} family Family name of WebFont.
   */
  WOFFGlitch.prototype.get = function(family, callback){
    var protocol = 'http';
    if (typeof(window )!== "undefined") protocol = 'https:' == window.location.protocol ? 'https:' : 'http:';
    var font_url = protocol + this._API_URL + '?family=' + family;
    this.font_family = family;
    console.log('before ajax.');
    $.ajax(font_url, {
      context: this,
      success: function(data)  {
        callback(data);
      },
      error:   function(status){
        console.log(status);
        this.emit('error', status);
      }
    });
  };

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
