/*
 * Copyright (C) 2015 Emweb bvba, Herent, Belgium.
 *
 * See the LICENSE file for terms of use.
 */

/* Note: this is at the same time valid JavaScript and C++. */

WT_DECLARE_WT_MEMBER
(1, JavaScriptConstructor, "WAxisSliderWidget",
 function(APP, widget, target, config) {
   // draw area: inside of the margins of the widget
   // config: { chart:, rect:(function), transform:, drawArea:, series: }
   var rqAnimFrame = (function(){
      return window.requestAnimationFrame       ||
	     window.webkitRequestAnimationFrame ||
	     window.mozRequestAnimationFrame    ||
             function(callback) {
		window.setTimeout(callback, 0);
	     };
   })();

   jQuery.data(widget, 'sobj', this);

   var self = this;
   var WT = APP.WT;

   target.canvas.style.msTouchAction = 'none';

   function isTouchEvent(event) {
      return event.pointerType === 2 || event.pointerType === 3 ||
	     event.pointerType === 'pen' || event.pointerType === 'touch';
   }

   var pointerActive = false;

   if (!window.TouchEvent && (window.MSPointerEvent || window.PointerEvent)) {
      (function(){
	 pointers = []

	 function updatePointerActive() {
	    if (pointers.length > 0 && !pointerActive) {
	       pointerActive = true;
	    } else if (pointers.length <= 0 && pointerActive) {
	       pointerActive = false;
	    }
	 }

	 function pointerDown(event) {
	    if (!isTouchEvent(event)) return;
	    event.preventDefault();
	    pointers.push(event);

	    updatePointerActive();
	    self.touchStarted(widget, {touches:pointers.slice(0)});
	 }

	 function pointerUp(event) {
	    if (!pointerActive) return;
	    if (!isTouchEvent(event)) return;
	    event.preventDefault();
	    var i;
	    for (i = 0; i < pointers.length; ++i) {
	       if (pointers[i].pointerId === event.pointerId) {
		  pointers.splice(i, 1);
		  break;
	       }
	    }

	    updatePointerActive();
	    self.touchEnded(widget, {touches:pointers.slice(0),changedTouches:[]});
	 }

	 function pointerMove(event) {
	    if (!isTouchEvent(event)) return;
	    event.preventDefault();
	    var i;
	    for (i = 0; i < pointers.length; ++i) {
	       if (pointers[i].pointerId === event.pointerId) {
		  pointers[i] = event;
		  break;
	       }
	    }

	    updatePointerActive();
	    self.touchMoved(widget, {touches:pointers.slice(0)});
	 }

	 if (!window.PointerEvent) {
	    widget.addEventListener('MSPointerDown', pointerDown);
	    widget.addEventListener('MSPointerUp', pointerUp);
	    widget.addEventListener('MSPointerOut', pointerUp);
	    widget.addEventListener('MSPointerMove', pointerMove);
	 } else {
	    widget.addEventListener('pointerdown', pointerDown);
	    widget.addEventListener('pointerup', pointerUp);
	    widget.addEventListener('pointerout', pointerUp);
	    widget.addEventListener('pointermove', pointerMove);
	 }
      })();
   }

   var left = WT.gfxUtils.rect_left,
       right = WT.gfxUtils.rect_right,
       top = WT.gfxUtils.rect_top,
       bottom = WT.gfxUtils.rect_bottom,
       normalized = WT.gfxUtils.rect_normalized,
       mult = WT.gfxUtils.transform_mult,
       apply = WT.gfxUtils.transform_apply;

   var previousXY = null;

   // positions:
   var LEFT_OF_RECT = 1, ON_RECT = 2, RIGHT_OF_RECT = 3;
   var position = null;

   function scheduleRepaint() {
      rqAnimFrame(target.repaint);
   }

   this.changeRange = function(u, v) {
      if (u < 0) u = 0;
      if (v > 1) v = 1;
      var drawArea = config.drawArea;
      config.transform[0] = v - u;
      config.transform[4] = u * drawArea[2];
      scheduleRepaint();
   }

   function repaint() {
      scheduleRepaint();
      var transform = config.transform;
      var drawArea = config.drawArea;
      var u = transform[4] / drawArea[2];
      var v = transform[0] + u;
      config.chart.setXRange(config.series, u, v);
   }

   function onLeftBorder(p, rect, borderSize) {
      return p.y >= top(rect) && p.y <= bottom(rect) && p.x > left(rect) - borderSize / 2 && p.x < left(rect) + borderSize / 2;
   }
   
   function onRightBorder(p, rect, borderSize) {
      return p.y >= top(rect) && p.y <= bottom(rect) && p.x > right(rect) - borderSize / 2 && p.x < right(rect) + borderSize / 2;
   }

   function isInside(p, rect) {
      return p.y >= top(rect) && p.y <= bottom(rect) && p.x > left(rect) && p.x < right(rect);
   }

   this.mouseDown = function(o, event) {
      if (pointerActive) return;
      previousXY = WT.widgetCoordinates(widget, event);
      var rect = config.rect();
      if (onLeftBorder(previousXY, rect, 10)) {
	 position = LEFT_OF_RECT;
      } else if (onRightBorder(previousXY, rect, 10)) {
	 position = RIGHT_OF_RECT;
      } else if (isInside(previousXY, rect)) {
	 position = ON_RECT;
      } else {
	 position = null;
	 return;
      }
      WT.cancelEvent(event);
   };

   this.mouseUp = function(o, event) {
      if (pointerActive) return;
      previousXY = null;
      if (position === null) return;
      position = null;
      WT.cancelEvent(event);
   };

   function dragLeft(dx) {
      var transform = config.transform;
      var drawArea = config.drawArea;
      var u = transform[4] / drawArea[2];
      var v = transform[0] + u;
      var xBefore = u * drawArea[2];
      var xAfter = xBefore + dx;
      var uAfter = xAfter / drawArea[2];
      if (1 / (v - uAfter) > config.chart.config.maxZoom[0]) {
	 return;
      }
      if (uAfter < 0) uAfter = 0;
      if (uAfter > 1) uAfter = 1;
      self.changeRange(uAfter, v);
      repaint();
   }

   function dragRight(dx) {
      var transform = config.transform;
      var drawArea = config.drawArea;
      var u = transform[4] / drawArea[2];
      var v = transform[0] + u;
      var xBefore = v * drawArea[2];
      var xAfter = xBefore + dx;
      var vAfter = xAfter / drawArea[2];
      if (1 / (vAfter - u) > config.chart.config.maxZoom[0]) {
	 return;
      }
      if (vAfter < 0) vAfter = 0;
      if (vAfter > 1) vAfter = 1;
      self.changeRange(u, vAfter);
      repaint();
   }

   function move(dx) {
      var transform = config.transform;
      var drawArea = config.drawArea;
      var u = transform[4] / drawArea[2];
      var v = transform[0] + u;
      var leftBefore = u * drawArea[2];
      var leftAfter = leftBefore + dx;
      if (leftAfter < 0) {
	 dx = -leftBefore;
	 leftAfter = 0;
      }
      var uAfter = leftAfter / drawArea[2];
      var rightBefore = v * drawArea[2];
      var rightAfter = rightBefore + dx;
      if (rightAfter > drawArea[2]) {
	 dx = drawArea[2] - rightBefore;
	 leftAfter = leftBefore + dx;
	 uAfter = leftAfter / drawArea[2];
	 rightAfter = drawArea[2];
      }
      var vAfter = rightAfter / drawArea[2];
      self.changeRange(uAfter, vAfter);
      repaint();
   }

   this.mouseDrag = function(o, event) {
      if (pointerActive) return;
      if (!position) return;
      WT.cancelEvent(event);
      var pos = WT.widgetCoordinates(widget, event);
      if (previousXY === null) {
	 previousXY = pos;
	 return;
      }
      var dx = pos.x - previousXY.x;
      switch (position) {
      case LEFT_OF_RECT:
	 dragLeft(dx);
	 break;
      case ON_RECT:
	 move(dx);
	 break;
      case RIGHT_OF_RECT:
	 dragRight(dx);
	 break;
      }
      previousXY = pos;
      repaint();
   };

   this.mouseMoved = function(o, event) {
      setTimeout(function() {
	 if (pointerActive) return;
	 if (position) return;
	 var pos = WT.widgetCoordinates(widget, event);
	 var rect = config.rect();
	 if (onLeftBorder(pos, rect, 10) || onRightBorder(pos, rect, 10)) {
	    target.canvas.style.cursor = 'col-resize';
	 } else if (isInside(pos,rect)) {
	    target.canvas.style.cursor = 'move';
	 } else {
	    target.canvas.style.cursor = 'auto';
	 }
      }, 0);
   };

   var singleTouch = false;
   var doubleTouch = false;

   var touchDelta = null;

   this.touchStarted = function(o, event) {
      singleTouch = event.touches.length === 1;
      doubleTouch = event.touches.length === 2;
      if (singleTouch) {
	 previousXY = WT.widgetCoordinates(target.canvas, event.touches[0]);
	 var rect = config.rect();
	 if (onLeftBorder(previousXY, rect, 20)) {
	    position = LEFT_OF_RECT;
	 } else if (onRightBorder(previousXY, rect, 20)) {
	    position = RIGHT_OF_RECT;
	 } else if (isInside(previousXY,rect)) {
	    position = ON_RECT;
	 } else {
	    position = null;
	    return;
	 }
	 WT.capture(null);
	 WT.capture(target.canvas);
	 if (event.preventDefault) event.preventDefault();
      } else if (doubleTouch) {
	 position = null;
	 var touches = [
	    WT.widgetCoordinates(target.canvas,event.touches[0]),
	    WT.widgetCoordinates(target.canvas,event.touches[1])
	 ];
	 var rect = config.rect();
	 if (!isInside(touches[0], rect) ||
	     !isInside(touches[1], rect)) return;
	 touchDelta = Math.abs(touches[0].x - touches[1].x);
	 WT.capture(null);
	 WT.capture(target.canvas);
	 if (event.preventDefault) event.preventDefault();
      }
   };

   this.touchEnded = function(o, event) {
      var touches = Array.prototype.slice.call(event.touches);

      var wasSingleTouch = singleTouch;
      var wasDoubleTouch = doubleTouch;
      var noTouch = touches.length === 0;
      singleTouch = touches.length === 1;
      doubleTouch = touches.length === 2;

      if (!noTouch) {
	 (function(){
	    var i;
	    for (i = 0; i < event.changedTouches.length; ++i) {
	       (function(){
		  var id = event.changedTouches[i].identifier;
		  for (var j = 0; j < touches.length; ++j) {
		     if (touches[j].identifier === id) {
			touches.splice(j, 1);
			return;
		     }
		  }
	       })();
	    }
	 })();
      }

      noTouch = touches.length === 0;
      singleTouch = touches.length === 1;
      doubleTouch = touches.length === 2;

      if (noTouch && wasSingleTouch) {
	 previousXY = null;
	 if (position === null) return;
	 position = null;
	 WT.cancelEvent(event);
      }
      if (singleTouch && wasDoubleTouch) {
	 doubleTouch = false;
	 touchDelta = null;
	 WT.cancelEvent(event);
	 self.touchStarted(widget, event);
      }
      if (noTouch && wasDoubleTouch) {
	 doubleTouch = false;
	 touchDelta = null;
	 WT.cancelEvent(event);
      }
   };

   this.touchMoved = function(o, event) {
      if (position) {
	 WT.cancelEvent(event);
	 var pos = WT.widgetCoordinates(widget, event);
	 if (previousXY === null) {
	    previousXY = pos;
	    return;
	 }
	 var dx = pos.x - previousXY.x;
	 switch (position) {
	 case LEFT_OF_RECT:
	    dragLeft(dx);
	    break;
	 case ON_RECT:
	    move(dx);
	    break;
	 case RIGHT_OF_RECT:
	    dragRight(dx);
	    break;
	 }
	 previousXY = pos;
	 repaint();
      } else if (doubleTouch) {
	 touches = [
	    WT.widgetCoordinates(target.canvas,event.touches[0]),
	    WT.widgetCoordinates(target.canvas,event.touches[1])
	 ];
	 var rect = config.rect();
	 var newDelta = Math.abs(touches[0].x - touches[1].x);
	 var d = newDelta - touchDelta;
	 dragLeft(-d/2);
	 dragRight(d/2);
	 touchDelta = newDelta;
      }
   };

   this.updateConfig = function(newConfig) {
      for (var key in newConfig) {
	 if (newConfig.hasOwnProperty(key)) {
	    config[key] = newConfig[key];
	 }
      }
      target.repaint();
   }

   self.updateConfig({});
 });

