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
    this.EE.on('font_css_loaded',       this.load_woff,       this);
    this.EE.on('font_css_loaded_error', this.error,           this);
    this.EE.on('font_woff_loaded',      this.glitchers.woff,  this);
    this.EE.on('font_glitched',         this.build_font_face, this);
    // TODO: Support TTF, OTF.
    // this.EE.on('font_truetype_loaded', this.log.error, this);
    // this.EE.on('font_opentype_loaded', this.log.error, this);
  }

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
    console.log(raw);
    var b64 = btoa(String.fromCharCode.apply(null, raw));
    // return "url('data:" + media_type + ";base64," + b64 + "')";
    return "data:" + media_type + ";base64," + b64 + "";
  };

  /**
   * Build font-face, insert font-face as a style element.
   *
   * @private
   */
  WOFFGlitch.prototype.build_font_face = function(raw, font){
    var font_face = font.original_css.replace(/url\(.+?\)/, "url('"+this._data_scheme(raw, font.format)+"')");
    var family    = this.font_family;
    this.log.debug(font_face);
    var that = this;
    $("<style></style>").text(font_face).appendTo($("head"));
    setTimeout(function(){
      $("html").css('font-family', family);
      that.EE.emit('woffglitch_callback', raw, family, font.format);
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
    var table_dir  = woff.table_dir_by_tag('glyf');
    var table_data = woff.font_table(table_dir.index);
    var that       = this;

    // Glitch!
    // table_data = table_data.replace(/0/, 1);

    setTimeout(function(){
      var font_array;
      woff.font_table(table_dir.index, table_data);
      font_array = woff.create();
      setTimeout(function(){that.EE.emit('font_glitched',font_array,font);}, 0);
    }, 0);
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
          // FIXME: depend on jQuery. Rewrite with plain XHR
          $.ajax(font.url, {
            beforeSend: function(xhr){
              xhr.overrideMimeType("text/plain; charset=x-user-defined");
            },
            context: this,
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
  };

  /**
   * Load glitched webfont.
   *
   * @public
   * @param {String} family Family name of WebFont.
   */
  WOFFGlitch.prototype.load = function(family, callback){
    var protocol = 'https:' == window.location.protocol ? 'https:' : 'http:';
    var font_url = protocol + this._API_URL + '?family=' + family;
    this.font_family = family;
    if (typeof(callback) !== "undefined") {
      this.EE.on('woffglitch_callback', callback, this);
    }
    $.ajax(font_url, {
      context: this,
      success: function(data)  {
        this.EE.emit('font_css_loaded', data);
      },
      error:   function(status){ this.EE.emit('error', status); }
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
        this.EE.emit('error', status);
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
