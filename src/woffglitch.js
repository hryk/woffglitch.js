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
    this.EE.on('font_css_loaded',       this.load_woff,      this);
    this.EE.on('font_css_loaded_error', this.error,          this);
    this.EE.on('font_woff_loaded',      this.glitchers.woff, this);
    this.EE.on('font_glitched',         this.build_font_face,this);
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
        media_type = 'application/font-woff';
      break;
      case 'opentype':
        media_type = 'application/vnd.ms-fontobject';
      break;
      default:
        this.log.error('_data_scheme: unsupported format "'+format+"'");
      break;
    }
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

    woff.font_table(table_dir.index).
        on('inflated_table', function(table_data) {
              table_data = table_data.replace(/0/, 1);
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
            // complete: function(xhr) {
            // },
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
  WOFFGlitch.prototype.load = function(family){
    var protocol = 'https:' == window.location.protocol ? 'https:' : 'http:';
    var font_url = protocol + this._API_URL + '?family=' + family;
    $.ajax(font_url, {
      context: this,
      success: function(data){ this.EE.emit('font_css_loaded', data); },
      error: function(status){ this.EE.emit('error', status); }
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
