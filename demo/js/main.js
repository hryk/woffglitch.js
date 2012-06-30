// main.js
//
EE = new EventEmitter2({
  wildcard: true,    // should the event emitter use wildcards.
  delimiter: '.',    // the delimiter used to segment namespaces, defaults to `.`.
  maxListeners: 20,  // the max number of listeners that can be assigned to an event, defaults to 10.
});

MAX_FONTS = 20;
FONTS  = fontlist().items;
ACTIVE = [];
FONT_VIEWS = [];

var delete_active_font = function(){
  var del = Math.floor(Math.random() * ACTIVE.length);
  var del_font = ACTIVE[del];
  console.log("DELETE: "+del_font);
  // delete display
  ACTIVE = ACTIVE.splice(del, 1);
};

var activated_fonts = function(family, desc){
  console.log(family);
  console.log(desc);
  ACTIVE.push(family);
};

var font_family = function(font){
  var family = font.family;
  var variant = "";
  var subset  = "";

  if (font.variants.length > 0)
    variant = font.variants[ Math.floor(Math.random() * font.variants.length) ];
  if (font.subsets.length > 0)
    subset = font.subsets[ Math.floor(Math.random() * font.subsets.length) ];

  return family+":"+variant+","+subset;
}

var load_fonts_randomly = function(){
  var max = FONTS.length;
  var font = FONTS[ Math.floor(Math.random() * max) ];
  // load font
  if (ACTIVE.length < Math.floor(MAX_FONTS * 0.75 )) {
    WebFont.load({
      google: { families: [ font_family(font) ] },
      fontactive: activated_fonts
    });
  }
  else if ((Math.floor(Math.random() * 10) % 2) == 0) {
    delete_active_font();
  }
};

var add_display = function(){
  var new_display = $('<h1>1VQ9</h1>');
  new_display.css({
    color: "#000",
    "font-size": Math.floor(Math.random() * 300) + 'px',
    position: 'absolute',
    display: "none",
    top: $('#container').innerHeight() / 2,
    left: $('#container').innerWidth() / 2
  });
  new_display.addClass('fdshow');
  FONT_VIEWS.push(new_display);
  $('#headlines').append(new_display);
};

var calc_move = function(top, left){
  var move_top, move_left;
  var window_width, window_height;
  window_width  = $('#container').innerWidth();
  window_height = $('#container').innerHeight();
  
  var calc_move_range = function(prev, range_max){
    if ((Math.floor(Math.random() * 10) % 6) > 2) {
      move_range = (Math.random() * (range_max / 2));
    }
    else {
      move_range = -1 * ( Math.random() * (range_max / 2));
    }
    if (prev+move_range > range_max || prev+move_range < 0) {
      while(prev+move_range > range_max || prev+move_range < 0){
        if ((Math.floor(Math.random() * 10) % 6) > 2) {
          move_range = (Math.random() * (range_max / 2));
        }
        else {
          move_range = -1 * ( Math.random() * (range_max / 2));
        }
      }
    }
    return move_range;
  };

  move_top  = calc_move_range(top,  window_height);
  move_left = calc_move_range(left, window_width);

  return { top: move_top, left: move_left};
};

var display_fonts = function(){
  var headline = $('#headlines');
  if (FONT_VIEWS.length < 25) {
    console.log('add display');
    add_display();
  }

  if (FONT_VIEWS.length > 0) {
    $.each(FONT_VIEWS, function(idx, display){
      if (display.hasClass('fdshow')){
        if ((Math.floor(Math.random() * 10) % 3) == 1) {
          display.fadeOut(2000 * Math.random(), function(){
            $(this).toggleClass('fdshow');
          });
        }
      }
      else {
        if ((Math.floor(Math.random() * 10) % 3) > 1) {
          display.fadeIn(2000 * Math.random(), function(){
            $(this).toggleClass('fdshow');
          });
        }
      }

      if (display.hasClass('fdshow')) {
        var prev_top  = parseInt(display.css('top'));
        var prev_left = parseInt(display.css('left'));
        var move_range = calc_move(prev_top, prev_left);

        display.animate({
          top:  prev_top  + move_range.top,
          left: prev_left + move_range.left
        });

        // Change font family & font size.
        if ((Math.floor(Math.random() * 10) % 6) > 2) {
          display.css({
            "font-family": ACTIVE[Math.floor(Math.random() * ACTIVE.length)],
          });
        }
        // "font-size": display.css('font-size')
      }
    });
  }
};

var change_number = function(){
  $.each(FONT_VIEWS, function(idx, display){
    var text  = display.text();
    var found = text.match(/(\d)VQ(\d)/);
    var prefix = parseInt(found[1]);
    var suffix = parseInt(found[2]);
    if (prefix < 9) {
      prefix += 1;
    }
    else {
      prefix = 1;
    }
    if (suffix > 0) {
      suffix -= 1;
    }
    else {
      suffix = 9;
    }
    display.text(prefix+'VQ'+suffix);
  });
};

var init_fonts = function(){
  setInterval(load_fonts_randomly, 2000);
  setInterval(display_fonts, 700);
  setInterval(change_number, 100);
};

$(function(){
  init_fonts();
});
