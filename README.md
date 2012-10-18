WOFFGlitch
----------

Glitch web fonts (.woff)

### Synopsys

    var woff_glitch = new WOFFGlitch();
    woff_glitch.load('http://font/url.woff');
    woff_glitch.on('load',
                   function(){ $('h1').css('font-family', 'Nunito')});

### Dependencies

 * rawdeflate.js
 * EventEmitter.js

### Author

hryk (@1vq9)

### License

See LICENSE.

### See Also

 * [ WOFF File Format 1.0 ](http://www.w3.org/TR/WOFF/)
 * [The TrueType Font File](https://developer.apple.com/fonts/TTRefMan/RM06/Chap6.html)

