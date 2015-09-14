
var INACTIVE = 0;
var ACTIVE = 1;
var SECONDS_INACTIVE = 0.5;

function loadSprite(src, callback) {
    var sprite = new Image();
    sprite.onload = callback;
    sprite.src = src;
    return sprite;
}


JoystickView = Backbone.View.extend({
    events: {
        "touchstart": "startControl",
        "touchmove": "move",
        "touchend": "endCotrol",
        "mousedown": "startControl",
        "mouseup": "endControl",
        "mousemove": "move"
    },
    initialize: function(squareSize, finishedLoadCallback){
        this.squareSize = squareSize;
        this.template = _.template($("#joystick-view").html());
        this.state = INACTIVE;
        this.x = 0;
        this.y = 0;
        this.canvas = null;
        this.context = null;
        this.radius = (this.squareSize / 2) * 0.5;

        this.finishedLoadCallback = finishedLoadCallback;

        this.joyStickLoaded = false;
        this.backgroundLoaded = false;
        this.lastTouch = new Date().getTime();
        self = this;
        setTimeout(function(){
            self._retractJoystickForInactivity();
        }, 1000);
        this.sprite = loadSprite("img/button.png", function(){
            self.joyStickLoaded = true;
            self._tryCallback();
        });
        this.background = loadSprite("img/canvas.png", function(){
            self.backgroundLoaded = true;
            self._tryCallback();
        });
    },
    _retractJoystickForInactivity: function(){
        var framesPerSec = 15;
        var self = this;
        setTimeout(function(){
            var currentTime = new Date().getTime();
            if(currentTime - self.lastTouch >= SECONDS_INACTIVE * 1000){
                self._retractToMiddle();
                self.renderSprite();
            }
            self._retractJoystickForInactivity();
        }, parseInt(1000 / framesPerSec, 10));
    },
    _tryCallback: function(){
        if(this.backgroundLoaded && this.joyStickLoaded){
            var self = this;
            this.finishedLoadCallback(self);
        }
    },
    startControl: function(evt){
        this.state = ACTIVE;
    },
    endControl: function(evt){
        this.state = INACTIVE;
        this.x = 0;
        this.y = 0;
        this.renderSprite();
    },
    move: function(evt){
        if(this.state == INACTIVE){
            return;
        }
        this.lastTouch = new Date().getTime();

        var x, y;


        if(evt.originalEvent && evt.originalEvent.touches){
            evt.preventDefault();
            var left = 0;
            var fromTop = 0;
            elem = $(this.canvas)[0];
            while(elem) {
                left = left + parseInt(elem.offsetLeft);
                fromTop = fromTop + parseInt(elem.offsetTop);
                elem = elem.offsetParent;
            }
            x = evt.originalEvent.touches[0].clientX - left;
            y = evt.originalEvent.touches[0].clientY - fromTop;
        } else {
            x = evt.offsetX;
            y = evt.offsetY;
        }
        this._mutateToCartesian(x, y);
        this._triggerChange();
    },
    _triggerChange: function(){
        var xPercent = this.x / this.radius;
        var yPercent = this.y / this.radius;
        if(Math.abs(xPercent) > 1.0){
            xPercent /= Math.abs(xPercent);
        }
        if(Math.abs(yPercent) > 1.0){
            yPercent /= Math.abs(yPercent);
        }
        this.trigger("horizontalMove", xPercent);
        this.trigger("verticalMove", yPercent);
    },
    _mutateToCartesian: function(x, y){
        x -= (this.squareSize) / 2;
        y *= -1;
        y += (this.squareSize) / 2;
        if(isNaN(y)){
            y = this.squareSize / 2;
        }

        this.x = x;
        this.y = y;
        if(this._valuesExceedRadius(this.x, this.y)){
            this._traceNewValues();
        }
        this.renderSprite();
    },
    _retractToMiddle: function(){
        var percentLoss = 0.1;
        var toKeep = 1.0 - percentLoss;

        var xSign = 1;
        var ySign = 1;

        if(this.x != 0){
            xSign = this.x / Math.abs(this.x);
        }
        if(this.y != 0) {
            ySign = this.y / Math.abs(this.y);
        }

        this.x = Math.floor(toKeep * Math.abs(this.x)) * xSign;
        this.y = Math.floor(toKeep * Math.abs(this.y)) * ySign;
    },
    _traceNewValues: function(){
        var slope = this.y / this.x;
        var xIncr = 1;
        if(this.x < 0){
            xIncr = -1;
        }
        for(var x=0; x<this.squareSize / 2; x+=xIncr){
            var y = x * slope;
            if(this._valuesExceedRadius(x, y)){
                break;
            }
        }
        this.x = x;
        this.y = y;
    },
    _cartesianToCanvas: function(x, y){
        var newX = x + this.squareSize / 2;
        var newY = y - (this.squareSize / 2);
        newY = newY * -1;
        return {
            x: newX,
            y: newY
        }
    },
    _valuesExceedRadius: function(x, y){
        if(x === 0){
            return y > this.radius;
        }
        return Math.pow(x, 2) + Math.pow(y, 2) > Math.pow(this.radius, 2);
    },
    renderSprite: function(){
        var originalWidth = 89;
        var originalHeight = 89;

        var spriteWidth = 50;
        var spriteHeight = 50;
        var pixelsLeft = 0; //ofset for sprite on img
        var pixelsTop = 0; //offset for sprite on img
        var coords = this._cartesianToCanvas(this.x, this.y);
        if(this.context == null){
            return;
        }
        // hack dunno why I need the 2x
        this.context.clearRect(0, 0, this.squareSize * 2, this.squareSize);

        var backImageSize = 300;
        this.context.drawImage(this.background,
            0,
            0,
            backImageSize,
            backImageSize,
            0,
            0,
            this.squareSize,
            this.squareSize
        )
        this.context.drawImage(this.sprite,
            pixelsLeft,
            pixelsTop,
            originalWidth,
            originalHeight,
            coords.x - spriteWidth / 2,
            coords.y - spriteHeight / 2,
            spriteWidth,
            spriteHeight
        );
    },
    render: function(){
        var renderData = {
            squareSize: this.squareSize
        };
        this.$el.html(this.template(renderData));
        this.canvas = this.$('#joystickCanvas')[0];
        this.context = this.canvas.getContext('2d');
        this.renderSprite();
        return this;
    }
});
