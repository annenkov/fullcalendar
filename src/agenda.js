
/* Agenda Views: agendaWeek/agendaDay
-----------------------------------------------------------------------------*/

setDefaults({
	allDaySlot: true,
	allDayText: 'all-day',
	firstHour: 6,
	slotMinutes: 30,
	defaultEventMinutes: 120,
	axisFormat: 'h(:mm)tt',
	timeFormat: {
		agenda: 'h:mm{ - h:mm}'
	},
	dragOpacity: {
		agenda: .5
	},
	minTime: 0,
	maxTime: 24
});

views.agendaWeek = function(element, options) {
	return new Agenda(element, options, {
		render: function(date, delta) {
			if (delta) {
				addDays(date, delta * 7);
			}
			var visStart = this.visStart = cloneDate(
					this.start = addDays(cloneDate(date), -((date.getDay() - options.firstDay + 7) % 7))
				),
				visEnd = this.visEnd = cloneDate(
					this.end = addDays(cloneDate(visStart), 7)
				);
			if (!options.weekends) {
				skipWeekend(visStart);
				skipWeekend(visEnd, -1, true);
			}
			this.title = formatDates(
				visStart,
				addDays(cloneDate(visEnd), -1),
				this.option('titleFormat'),
				options
			);
			this.renderAgenda(
				options.weekends ? 7 : 5,
				this.option('columnFormat')
			);
		}
	});
};

views.agendaDay = function(element, options) {
	return new Agenda(element, options, {
		render: function(date, delta) {
			if (delta) {
				addDays(date, delta);
				if (!options.weekends) {
					skipWeekend(date, delta < 0 ? -1 : 1);
				}
			}
			this.title = formatDate(date, this.option('titleFormat'), options);
			this.start = this.visStart = cloneDate(date, true);
			this.end = this.visEnd = addDays(cloneDate(this.start), 1);
			this.renderAgenda(
				1,
				this.option('columnFormat')
			);
		}
	});
};

function Agenda(element, options, methods) {

	var head, body, bodyContent, bodyTable, bg,
		colCnt,
		slotCnt=0, // spanning all the way across
		axisWidth, colWidth, slotHeight,
		viewWidth, viewHeight,
		savedScrollTop,
		cachedEvents=[],
		daySegmentContainer,
		slotSegmentContainer,
		tm, firstDay,
		nwe,            // no weekends (int)
		rtl, dis, dit,  // day index sign / translate
		minMinute, maxMinute,
		colContentPositions = new HorizontalPositionCache(function(col) {
			return bg.find('td:eq(' + col + ') div div');
		}),
		slotTopCache = {},
		// ...
		
	view = $.extend(this, viewMethods, methods, {
		renderAgenda: renderAgenda,
		renderEvents: renderEvents,
		rerenderEvents: rerenderEvents,
		clearEvents: clearEvents,
		setHeight: setHeight,
		setWidth: setWidth,
		beforeHide: function() {
			savedScrollTop = body.scrollTop();
		},
		afterShow: function() {
			body.scrollTop(savedScrollTop);
		},
		defaultEventEnd: function(event) {
			var start = cloneDate(event.start);
			if (event.allDay) {
				return start;
			}
			return addMinutes(start, options.defaultEventMinutes);
		}
	});
	view.init(element, options);
	
	
	
	/* Time-slot rendering
	-----------------------------------------------------------------------------*/
	
	
	element.addClass('fc-agenda');
	if (element.disableSelection) {
		element.disableSelection();
	}
	
	function renderAgenda(c, colFormat) {
		colCnt = c;
		
		// update option-derived variables
		tm = options.theme ? 'ui' : 'fc';
		nwe = options.weekends ? 0 : 1;
		firstDay = options.firstDay;
		if (rtl = options.isRTL) {
			dis = -1;
			dit = colCnt - 1;
		}else{
			dis = 1;
			dit = 0;
		}
		minMinute = parseTime(options.minTime);
		maxMinute = parseTime(options.maxTime);
		
		var d0 = rtl ? addDays(cloneDate(view.visEnd), -1) : cloneDate(view.visStart),
			d = cloneDate(d0),
			today = clearTime(new Date());
		
		if (!head) { // first time rendering, build from scratch
		
			var i,
				minutes,
				slotNormal = options.slotMinutes % 15 == 0, //...
			
			// head
			s = "<div class='fc-agenda-head' style='position:relative;z-index:4'>" +
				"<table style='width:100%'>" +
				"<tr class='fc-first" + (options.allDaySlot ? '' : ' fc-last') + "'>" +
				"<th class='fc-leftmost " +
					tm + "-state-default'>&nbsp;</th>";
			for (i=0; i<colCnt; i++) {
				s += "<th class='fc-" +
					dayIDs[d.getDay()] + ' ' + // needs to be first
					tm + '-state-default' +
					"'>" + formatDate(d, colFormat, options) + "</th>";
				addDays(d, dis);
				if (nwe) {
					skipWeekend(d, dis);
				}
			}
			s += "<th class='" + tm + "-state-default'>&nbsp;</th></tr>";
			if (options.allDaySlot) {
				s += "<tr class='fc-all-day'>" +
						"<th class='fc-axis fc-leftmost " + tm + "-state-default'>" + options.allDayText + "</th>" +
						"<td colspan='" + colCnt + "' class='" + tm + "-state-default'>" +
							"<div class='fc-day-content'><div style='position:relative'>&nbsp;</div></div></td>" +
						"<th class='" + tm + "-state-default'>&nbsp;</th>" +
					"</tr><tr class='fc-divider fc-last'><th colspan='" + (colCnt+2) + "' class='" +
						tm + "-state-default fc-leftmost'><div/></th></tr>";
			}
			s+= "</table></div>";
			head = $(s).appendTo(element);
			bindDayHandlers(head.find('td'));
			
			// all-day event container
			daySegmentContainer = $("<div style='position:absolute;z-index:8;top:0;left:0'/>").appendTo(head);
			
			// body
			d = zeroDate();
			var maxd = addMinutes(cloneDate(d), maxMinute);
			addMinutes(d, minMinute);
			s = "<table>";
			for (i=0; d < maxd; i++) {
				minutes = d.getMinutes();
				s += "<tr class='" +
					(!i ? 'fc-first' : (!minutes ? '' : 'fc-minor')) +
					"'><th class='fc-axis fc-leftmost " + tm + "-state-default'>" +
					((!slotNormal || !minutes) ? formatDate(d, options.axisFormat) : '&nbsp;') + 
					"</th><td class='fc-slot" + i + ' ' +
						tm + "-state-default'><div style='position:relative'>&nbsp;</div></td></tr>";
				addMinutes(d, options.slotMinutes);
				slotCnt++;
			}
			s += "</table>";
			body = $("<div class='fc-agenda-body' style='position:relative;z-index:2;overflow:auto'/>")
				.append(bodyContent = $("<div style='position:relative;overflow:hidden'>")
					.append(bodyTable = $(s)))
				.appendTo(element);
			bindSlotHandlers(body.find('td')); // .click(slotClick);
			
			// slot event container
			slotSegmentContainer = $("<div style='position:absolute;z-index:8;top:0;left:0'/>").appendTo(bodyContent);
			
			// background stripes
			d = cloneDate(d0);
			s = "<div class='fc-agenda-bg' style='position:absolute;z-index:1'>" +
				"<table style='width:100%;height:100%'><tr class='fc-first'>";
			for (i=0; i<colCnt; i++) {
				s += "<td class='fc-" +
					dayIDs[d.getDay()] + ' ' + // needs to be first
					tm + '-state-default ' +
					(!i ? 'fc-leftmost ' : '') +
					(+d == +today ? tm + '-state-highlight fc-today' : 'fc-not-today') +
					"'><div class='fc-day-content'><div>&nbsp;</div></div></td>";
				addDays(d, dis);
				if (nwe) {
					skipWeekend(d, dis);
				}
			}
			s += "</tr></table></div>";
			bg = $(s).appendTo(element);
			
		}else{ // skeleton already built, just modify it
		
			clearEvents();
			
			// redo column header text and class
			head.find('tr:first th').slice(1, -1).each(function() {
				$(this).text(formatDate(d, colFormat, options));
				this.className = this.className.replace(/^fc-\w+(?= )/, 'fc-' + dayIDs[d.getDay()]);
				addDays(d, dis);
				if (nwe) {
					skipWeekend(d, dis);
				}
			});
			
			// change classes of background stripes
			d = cloneDate(d0);
			bg.find('td').each(function() {
				this.className = this.className.replace(/^fc-\w+(?= )/, 'fc-' + dayIDs[d.getDay()]);
				if (+d == +today) {
					$(this)
						.removeClass('fc-not-today')
						.addClass('fc-today')
						.addClass(tm + '-state-highlight');
				}else{
					$(this)
						.addClass('fc-not-today')
						.removeClass('fc-today')
						.removeClass(tm + '-state-highlight');
				}
				addDays(d, dis);
				if (nwe) {
					skipWeekend(d, dis);
				}
			});
		
		}
		
		unselect();
		
	}
	
	
	function resetScroll() {
		var d0 = zeroDate(),
			scrollDate = cloneDate(d0);
		scrollDate.setHours(options.firstHour);
		var top = timePosition(d0, scrollDate) + 1, // +1 for the border
			scroll = function() {
				body.scrollTop(top);
			};
		scroll();
		setTimeout(scroll, 0); // overrides any previous scroll state made by the browser
	}
	
	
	function setHeight(height, dateChanged) {
		viewHeight = height;
		slotTopCache = {};
		
		body.height(height - head.height());
		
		slotHeight = body.find('tr:first div').height() + 1;
		
		bg.css({
			top: head.find('tr').height(),
			height: height
		});
		
		if (dateChanged) {
			resetScroll();
		}
	}
	
	
	function setWidth(width) {
		viewWidth = width;
		colContentPositions.clear();
		
		body.width(width);
		bodyTable.width('');
		
		var topTDs = head.find('tr:first th'),
			stripeTDs = bg.find('td'),
			clientWidth = body[0].clientWidth;
			
		bodyTable.width(clientWidth);
		
		// time-axis width
		axisWidth = 0;
		setOuterWidth(
			head.find('tr:lt(2) th:first').add(body.find('tr:first th'))
				.width('')
				.each(function() {
					axisWidth = Math.max(axisWidth, $(this).outerWidth());
				}),
			axisWidth
		);
		
		// column width
		colWidth = Math.floor((clientWidth - axisWidth) / colCnt);
		setOuterWidth(stripeTDs.slice(0, -1), colWidth);
		setOuterWidth(topTDs.slice(1, -2), colWidth);
		setOuterWidth(topTDs.slice(-2, -1), clientWidth - axisWidth - colWidth*(colCnt-1));
		
		bg.css({
			left: axisWidth,
			width: clientWidth - axisWidth
		});
	}
	
	
	
	/* Slot/Day clicking and selecting
	-----------------------------------------------------------------------*/
	
	var selected=false,
		selectHelper,
		selectMatrix;
	
	function slotClick(ev) {
		var col = Math.floor((ev.pageX - bg.offset().left) / colWidth),
			date = addDays(cloneDate(view.visStart), dit + dis*col),
			rowMatch = this.className.match(/fc-slot(\d+)/);
		if (rowMatch) {
			var mins = parseInt(rowMatch[1]) * options.slotMinutes,
				hours = Math.floor(mins/60);
			date.setHours(hours);
			date.setMinutes(mins%60 + minMinute);
			view.trigger('dayClick', this, date, false, ev);
		}else{
			view.trigger('dayClick', this, date, true, ev);
		}
	}
	
	function unselect() {
		if (selected) {
			if (selectHelper) {
				selectHelper.remove();
				selectHelper = null;
			}
			view.clearOverlays();
			view.trigger('unselect', view);
			selected = false;
		}
	}
	view.unselect = unselect;
	
	if (view.option('selectable') && view.option('unselectable')) {
		$(document).mousedown(function() {
			unselect();
		});
	}
	
	
	// all-day
	
	var daySelectStart, // the "column" of the day
		daySelectEnd,   // the "column" of the day
		daySelectRange;
	
	function bindDayHandlers(tds) {
		tds.click(slotClick);
		if (view.option('selectable')) {
			tds.mousedown(daySelectMousedown);
		}
	}
	
	function daySelectMousedown(ev) {
		daySelectStart = undefined;
		selectMatrix = buildMainMatrix(function(cell) {
			view.clearOverlays();
			if (selectHelper) {
				selectHelper.remove(); // todo: turn these lines into _unselect()
				selectHelper = null;
			}
			if (cell) {
				selected = true;
				daySelectEnd = cell.col;
				if (daySelectStart === undefined) {
					daySelectStart = daySelectEnd;
				}
				daySelectRange = [daySelectStart, daySelectEnd].sort(cmp);
				renderDayOverlay(selectMatrix, daySelectRange[0], daySelectRange[1]+1);
				bindDayHandlers(view.overlays[0]);
			}else{
				selected = false;
			}
		});
		$(document)
			.mousemove(daySelectMousemove)
			.mouseup(daySelectMouseup);
		selectMatrix.mouse(ev.pageX, ev.pageY);
		ev.stopPropagation();
	}
	
	function daySelectMousemove(ev) {
		selectMatrix.mouse(ev.pageX, ev.pageY);
	}
	
	function daySelectMouseup(ev) {
		$(document)
			.unbind('mousemove', daySelectMousemove)
			.unbind('mouseup', daySelectMouseup);
		if (selected) {
			view.trigger(
				'select',
				view,
				addDays(cloneDate(view.visStart), daySelectRange[0]),
				addDays(cloneDate(view.visStart), daySelectRange[1]+1),
				true
			);
		}
	}
	
	
	// slot
	
	function bindSlotHandlers(tds) {
		tds.click(slotClick);
		if (view.option('selectable')) {
			tds.mousedown(slotSelectMousedown);
		}
	}
	
	var slotSelectDay,
		slotSelectStart, // the "row" of the slot
		slotSelectEnd,   // the "row" of the slot
		slotSelectRange;
	
	function slotSelectMousedown(ev) {
		slotSelectDay = undefined;
		selectMatrix = buildSlotMatrix(function(cell) {
			view.clearOverlays();
			if (slotSelectDay === undefined) {
				slotSelectDay = cell.col;
				slotSelectStart = cell.row;
			}
			if (selectHelper) {
				selectHelper.remove();
				selectHelper = null;
			}
			if (cell) {
				selected = true;
				slotSelectEnd = cell.row;
				slotSelectRange = [slotSelectStart, slotSelectEnd].sort(cmp);
				if (view.option('selectHelper')) {
					var rect = selectMatrix.rect(slotSelectRange[0], slotSelectDay, slotSelectRange[1]+1, slotSelectDay+1, bodyContent);
					selectHelper =
						$(segHtml(
							{ title: '', start: slotTime(slotSelectDay, slotSelectRange[0]), end: slotTime(slotSelectDay, slotSelectRange[1]+1), className: [], editable:false },
							{ top: rect.top, left: rect.left+2 },
							'fc-event fc-event-vert fc-corner-top fc-corner-bottom '
						));
					if (!$.browser.msie) {
						// IE makes the event completely clear!!?
						selectHelper.css('opacity', view.option('dragOpacity'));
					}
					// TODO: change cursor
					bindSlotHandlers(selectHelper);
					bodyContent.append(selectHelper);
					setOuterWidth(selectHelper, rect.width-5, true);
					setOuterHeight(selectHelper, rect.height, true);
				}else{
					view.renderOverlay(
						selectMatrix.rect(slotSelectRange[0], slotSelectDay, slotSelectRange[1]+1, slotSelectDay+1, bodyContent),
						bodyContent
					);
					bindSlotHandlers(view.overlays[0]);
				}
			}else{
				selected = false;
				slotSelectEnd = undefined;
			}
		});
		selectMatrix.mouse(ev.pageX, ev.pageY);
		$(document)
			.mousemove(slotSelectMousemove)
			.mouseup(slotSelectMouseup);
		ev.stopPropagation();
	}
	
	function slotSelectMousemove(ev) {
		selectMatrix.mouse(ev.pageX, ev.pageY);
	}
	
	function slotSelectMouseup(ev) {
		$(document)
			.unbind('mousemove', slotSelectMousemove)
			.unbind('mouseup', slotSelectMouseup);
		if (selected) {
			view.trigger('select',
				view,
				slotTime(slotSelectDay, slotSelectRange[0]),
				slotTime(slotSelectDay, slotSelectRange[1]+1),
				false
			);
		}
	}
	
	
	
	
	
	/* Event Rendering
	-----------------------------------------------------------------------------*/
	
	function renderEvents(events, modifiedEventId) {
		view.reportEvents(cachedEvents = events);
		var i, len=events.length,
			dayEvents=[],
			slotEvents=[];
		for (i=0; i<len; i++) {
			if (events[i].allDay) {
				dayEvents.push(events[i]);
			}else{
				slotEvents.push(events[i]);
			}
		}
		renderDaySegs(compileDaySegs(dayEvents), modifiedEventId);
		renderSlotSegs(compileSlotSegs(slotEvents), modifiedEventId);
	}
	
	
	function rerenderEvents(modifiedEventId) {
		clearEvents();
		renderEvents(cachedEvents, modifiedEventId);
	}
	
	
	function clearEvents() {
		view._clearEvents(); // only clears the hashes
		daySegmentContainer.empty();
		slotSegmentContainer.empty();
	}
	
	
	
	
	
	function compileDaySegs(events) {
		var levels = stackSegs(view.sliceSegs(events, $.map(events, visEventEnd), view.visStart, view.visEnd)),
			i, levelCnt=levels.length, level,
			j, seg,
			segs=[];
		for (i=0; i<levelCnt; i++) {
			level = levels[i];
			for (j=0; j<level.length; j++) {
				seg = level[j];
				seg.row = 0;
				seg.level = i;
				segs.push(seg);
			}
		}
		return segs;
	}
	
	
	function compileSlotSegs(events) {
		var d = addMinutes(cloneDate(view.visStart), minMinute),
			visEventEnds = $.map(events, visEventEnd),
			i, col,
			j, level,
			k, seg,
			segs=[];
		for (i=0; i<colCnt; i++) {
			col = stackSegs(view.sliceSegs(events, visEventEnds, d, addMinutes(cloneDate(d), maxMinute-minMinute)));
			countForwardSegs(col);
			for (j=0; j<col.length; j++) {
				level = col[j];
				for (k=0; k<level.length; k++) {
					seg = level[k];
					seg.col = i;
					seg.level = j;
					segs.push(seg);
				}
			}
			addDays(d, 1, true);
		}
		return segs;
	}
	
	
	
	
	// renders 'all-day' events at the top
	
	function renderDaySegs(segs, modifiedEventId) {
		if (options.allDaySlot) {
			_renderDaySegs(
				segs,
				1,
				view,
				axisWidth,
				viewWidth,
				function() {
					return head.find('tr.fc-all-day');
				},
				function(dayOfWeek) {
					return axisWidth + colContentPositions.left(day2col(dayOfWeek));
				},
				function(dayOfWeek) {
					return axisWidth + colContentPositions.right(day2col(dayOfWeek));
				},
				daySegmentContainer,
				bindDaySegHandlers,
				modifiedEventId
			);
			setHeight(viewHeight); // might have pushed the body down, so resize
		}
	}
	
	
	
	// renders events in the 'time slots' at the bottom
	
	function renderSlotSegs(segs, modifiedEventId) {
	
		var i, segCnt=segs.length, seg,
			event,
			className,
			top, bottom,
			colI, levelI, forward,
			leftmost,
			availWidth,
			outerWidth,
			left,
			html='',
			eventElements,
			eventElement,
			triggerRes,
			vsideCache={},
			hsideCache={},
			key, val,
			titleSpan,
			height;
			
		// calculate position/dimensions, create html
		for (i=0; i<segCnt; i++) {
			seg = segs[i];
			event = seg.event;
			className = 'fc-event fc-event-vert ';
			if (seg.isStart) {
				className += 'fc-corner-top ';
			}
			if (seg.isEnd) {
				className += 'fc-corner-bottom ';
			}
			top = timePosition(seg.start, seg.start);
			bottom = timePosition(seg.start, seg.end);
			colI = seg.col;
			levelI = seg.level;
			forward = seg.forward || 0;
			leftmost = axisWidth + colContentPositions.left(colI*dis + dit);
			availWidth = axisWidth + colContentPositions.right(colI*dis + dit) - leftmost;
			availWidth = Math.min(availWidth-6, availWidth*.95); // TODO: move this to CSS
			if (levelI) {
				// indented and thin
				outerWidth = availWidth / (levelI + forward + 1);
			}else{
				if (forward) {
					// moderately wide, aligned left still
					outerWidth = ((availWidth / (forward + 1)) - (12/2)) * 2; // 12 is the predicted width of resizer =
				}else{
					// can be entire width, aligned left
					outerWidth = availWidth;
				}
			}
			left = leftmost +                                  // leftmost possible
				(availWidth / (levelI + forward + 1) * levelI) // indentation
				* dis + (rtl ? availWidth - outerWidth : 0);   // rtl
			seg.top = top;
			seg.left = left;
			seg.outerWidth = outerWidth;
			seg.outerHeight = bottom - top;
			html += segHtml(event, seg, className);
		}
		slotSegmentContainer[0].innerHTML = html; // faster than html()
		eventElements = slotSegmentContainer.children();
		
		// retrieve elements, run through eventRender callback, bind event handlers
		for (i=0; i<segCnt; i++) {
			seg = segs[i];
			event = seg.event;
			eventElement = $(eventElements[i]); // faster than eq()
			triggerRes = view.trigger('eventRender', event, event, eventElement);
			if (triggerRes === false) {
				eventElement.remove();
			}else{
				if (triggerRes && triggerRes !== true) {
					eventElement.remove();
					eventElement = $(triggerRes)
						.css({
							position: 'absolute',
							top: seg.top,
							left: seg.left
						})
						.appendTo(slotSegmentContainer);
				}
				seg.element = eventElement;
				if (event._id === modifiedEventId) {
					bindSlotSegHandlers(event, eventElement, seg);
				}else{
					eventElement[0]._fci = i; // for lazySegBind
				}
				view.reportEventElement(event, eventElement);
			}
		}
		
		lazySegBind(slotSegmentContainer, segs, bindSlotSegHandlers);
		
		// record event sides and title positions
		for (i=0; i<segCnt; i++) {
			seg = segs[i];
			if (eventElement = seg.element) {
				val = vsideCache[key = seg.key = cssKey(eventElement[0])];
				seg.vsides = val === undefined ? (vsideCache[key] = vsides(eventElement[0], true)) : val;
				val = hsideCache[key];
				seg.hsides = val === undefined ? (hsideCache[key] = hsides(eventElement[0], true)) : val;
				titleSpan = eventElement.find('span.fc-event-title');
				if (titleSpan.length) {
					seg.titleTop = titleSpan[0].offsetTop;
				}
			}
		}
		
		// set all positions/dimensions at once
		for (i=0; i<segCnt; i++) {
			seg = segs[i];
			if (eventElement = seg.element) {
				eventElement[0].style.width = seg.outerWidth - seg.hsides + 'px';
				eventElement[0].style.height = (height = seg.outerHeight - seg.vsides) + 'px';
				event = seg.event;
				if (seg.titleTop !== undefined && height - seg.titleTop < 10) {
					// not enough room for title, put it in the time header
					eventElement.find('span.fc-event-time')
						.text(formatDate(event.start, view.option('timeFormat')) + ' - ' + event.title);
					eventElement.find('span.fc-event-title')
						.remove();
				}
				view.trigger('eventAfterRender', event, event, eventElement);
			}
		}
					
	}
	
	
	function segHtml(event, seg, className) {
		return "<div class='" + className + event.className.join(' ') + "' style='position:absolute;z-index:8;top:" + seg.top + "px;left:" + seg.left + "px'>" +
			"<a" + (event.url ? " href='" + htmlEscape(event.url) + "'" : '') + ">" +
				"<span class='fc-event-bg'></span>" +
				"<span class='fc-event-time'>" + htmlEscape(formatDates(event.start, event.end, view.option('timeFormat'))) + "</span>" +
				"<span class='fc-event-title'>" + htmlEscape(event.title) + "</span>" +
			"</a>" +
			((event.editable || event.editable === undefined && options.editable) && !options.disableResizing && $.fn.resizable ?
				"<div class='ui-resizable-handle ui-resizable-s'>=</div>"
				: '') +
		"</div>";
	}
	
	
	function visEventEnd(event) { // returns exclusive 'visible' end, for rendering
		if (event.allDay) {
			return visEventEndAllDay(event);
		}
		if (event.end) {
			return cloneDate(event.end);
		}else{
			return addMinutes(cloneDate(event.start), options.defaultEventMinutes);
		}
	}
	
	
	function visEventEndAllDay(event) {
		if (event.end) {
			var end = cloneDate(event.end);
			return (event.allDay || end.getHours() || end.getMinutes()) ? addDays(end, 1) : end;
		}else{
			return addDays(cloneDate(event.start), 1);
		}
	}
	
	
	
	function bindDaySegHandlers(event, eventElement, seg) {
		view.eventElementHandlers(event, eventElement);
		if (event.editable || event.editable === undefined && options.editable) {
			draggableDayEvent(event, eventElement, seg.isStart);
			if (seg.isEnd) {
				view.resizableDayEvent(event, eventElement, colWidth);
			}
		}
	}
	
	
	
	function bindSlotSegHandlers(event, eventElement, seg) {
		view.eventElementHandlers(event, eventElement);
		if (event.editable || event.editable === undefined && options.editable) {
			var timeElement = eventElement.find('span.fc-event-time');
			draggableSlotEvent(event, eventElement, timeElement);
			if (seg.isEnd) {
				resizableSlotEvent(event, eventElement, timeElement);
			}
		}
	}

	
	
	
	/* Event Dragging
	-----------------------------------------------------------------------------*/
	
	
	
	// when event starts out FULL-DAY
	
	function draggableDayEvent(event, eventElement, isStart) {
		if (!options.disableDragging && eventElement.draggable) {
			var origPosition, origWidth,
				resetElement,
				allDay=true,
				matrix;
			eventElement.draggable({
				zIndex: 9,
				opacity: view.option('dragOpacity', 'month'), // use whatever the month view was using
				revertDuration: options.dragRevertDuration,
				start: function(ev, ui) {
					view.hideEvents(event, eventElement);
					view.trigger('eventDragStart', eventElement, event, ev, ui);
					origPosition = eventElement.position();
					origWidth = eventElement.width();
					resetElement = function() {
						if (!allDay) {
							eventElement
								.width(origWidth)
								.height('')
								.draggable('option', 'grid', null);
							allDay = true;
						}
					};
					matrix = buildMainMatrix(function(cell) {
						eventElement.draggable('option', 'revert', !cell || !cell.rowDelta && !cell.colDelta);
						view.clearOverlays();
						if (cell) {
							if (!cell.row) {
								// on full-days
								renderDayOverlay(
									matrix,
									cellOffset(addDays(cloneDate(event.start), cell.colDelta)),
									cellOffset(addDays(visEventEnd(event), cell.colDelta)) // visEventEnd returns a clone
								);
								resetElement();
							}else{
								// mouse is over bottom slots
								if (isStart && allDay) {
									// convert event to temporary slot-event
									setOuterHeight(
										eventElement.width(colWidth - 10), // don't use entire width
										slotHeight * Math.round(
											(event.end ? ((event.end - event.start)/MINUTE_MS) : options.defaultEventMinutes)
											/options.slotMinutes)
									);
									eventElement.draggable('option', 'grid', [colWidth, 1]);
									allDay = false;
								}
							}
						}
					});
					matrix.mouse(ev.pageX, ev.pageY);
				},
				drag: function(ev, ui) {
					matrix.mouse(ev.pageX, ev.pageY);
				},
				stop: function(ev, ui) {
					view.trigger('eventDragStop', eventElement, event, ev, ui);
					view.clearOverlays();
					var cell = matrix.cell;
					var dayDelta = dis * (
						allDay ? // can't trust cell.colDelta when using slot grid
							(cell ? cell.colDelta : 0) :
							Math.floor((ui.position.left - origPosition.left) / colWidth)
					);
					if (!cell || !dayDelta && !cell.rowDelta) {
						// over nothing (has reverted)
						resetElement();
						if ($.browser.msie) {
							eventElement.css('filter', ''); // clear IE opacity side-effects
						}
						view.showEvents(event, eventElement);
					}else{
						eventElement.find('a').removeAttr('href'); // prevents safari from visiting the link
						view.eventDrop(
							this, event, dayDelta,
							allDay ? 0 : // minute delta
								Math.round((eventElement.offset().top - bodyContent.offset().top) / slotHeight)
								* options.slotMinutes
								+ minMinute
								- (event.start.getHours() * 60 + event.start.getMinutes()),
							allDay, ev, ui
						);
					}
				}
			});
		}
	}
	
	
	
	// when event starts out IN TIMESLOTS
	
	function draggableSlotEvent(event, eventElement, timeElement) {
		if (!options.disableDragging && eventElement.draggable) {
			var origPosition,
				resetElement,
				prevSlotDelta, slotDelta,
				allDay=false,
				matrix;
			eventElement.draggable({
				zIndex: 9,
				scroll: false,
				grid: [colWidth, slotHeight],
				axis: colCnt==1 ? 'y' : false,
				opacity: view.option('dragOpacity'),
				revertDuration: options.dragRevertDuration,
				start: function(ev, ui) {
					view.hideEvents(event, eventElement);
					view.trigger('eventDragStart', eventElement, event, ev, ui);
					if ($.browser.msie) {
						eventElement.find('span.fc-event-bg').hide(); // nested opacities mess up in IE, just hide
					}
					origPosition = eventElement.position();
					resetElement = function() {
						// convert back to original slot-event
						if (allDay) {
							timeElement.css('display', ''); // show() was causing display=inline
							eventElement.draggable('option', 'grid', [colWidth, slotHeight]);
							allDay = false;
						}
					};
					prevSlotDelta = 0;
					matrix = buildMainMatrix(function(cell) {
						eventElement.draggable('option', 'revert', !cell);
						view.clearOverlays();
						if (cell) {
							if (!cell.row && options.allDaySlot) { // over full days
								if (!allDay) {
									// convert to temporary all-day event
									allDay = true;
									timeElement.hide();
									eventElement.draggable('option', 'grid', null);
								}
								renderDayOverlay(
									matrix,
									cellOffset(addDays(cloneDate(event.start), cell.colDelta)),
									cellOffset(addDays(visEventEndAllDay(event), cell.colDelta)) // visEventEnd returns a clone
								);
							}else{ // on slots
								resetElement();
							}
						}
					});
					matrix.mouse(ev.pageX, ev.pageY);
				},
				drag: function(ev, ui) {
					slotDelta = Math.round((ui.position.top - origPosition.top) / slotHeight);
					if (slotDelta != prevSlotDelta) {
						if (!allDay) {
							// update time header
							var minuteDelta = slotDelta*options.slotMinutes,
								newStart = addMinutes(cloneDate(event.start), minuteDelta),
								newEnd;
							if (event.end) {
								newEnd = addMinutes(cloneDate(event.end), minuteDelta);
							}
							timeElement.text(formatDates(newStart, newEnd, view.option('timeFormat')));
						}
						prevSlotDelta = slotDelta;
					}
					matrix.mouse(ev.pageX, ev.pageY);
				},
				stop: function(ev, ui) {
					view.clearOverlays();
					view.trigger('eventDragStop', eventElement, event, ev, ui);
					var cell = matrix.cell,
						dayDelta = dis * (
							allDay ? // can't trust cell.colDelta when using slot grid
							(cell ? cell.colDelta : 0) : 
							Math.floor((ui.position.left - origPosition.left) / colWidth)
						);
					if (!cell || !slotDelta && !dayDelta) {
						resetElement();
						if ($.browser.msie) {
							eventElement
								.css('filter', '') // clear IE opacity side-effects
								.find('span.fc-event-bg').css('display', ''); // .show() made display=inline
						}
						eventElement.css(origPosition); // sometimes fast drags make event revert to wrong position
						view.showEvents(event, eventElement);
					}else{
						view.eventDrop(
							this, event, dayDelta,
							allDay ? 0 : slotDelta * options.slotMinutes, // minute delta
							allDay, ev, ui
						);
					}
				}
			});
		}
	}
	
	
	
	
	/* Event Resizing
	-----------------------------------------------------------------------------*/
	
	// for TIMESLOT events

	function resizableSlotEvent(event, eventElement, timeElement) {
		if (!options.disableResizing && eventElement.resizable) {
			var slotDelta, prevSlotDelta;
			eventElement.resizable({
				handles: {
					s: 'div.ui-resizable-s'
				},
				grid: slotHeight,
				start: function(ev, ui) {
					slotDelta = prevSlotDelta = 0;
					view.hideEvents(event, eventElement);
					if ($.browser.msie && $.browser.version == '6.0') {
						eventElement.css('overflow', 'hidden');
					}
					eventElement.css('z-index', 9);
					view.trigger('eventResizeStart', this, event, ev, ui);
				},
				resize: function(ev, ui) {
					// don't rely on ui.size.height, doesn't take grid into account
					slotDelta = Math.round((Math.max(slotHeight, eventElement.height()) - ui.originalSize.height) / slotHeight);
					if (slotDelta != prevSlotDelta) {
						timeElement.text(
							formatDates(
								event.start,
								(!slotDelta && !event.end) ? null : // no change, so don't display time range
									addMinutes(view.eventEnd(event), options.slotMinutes*slotDelta),
								view.option('timeFormat')
							)
						);
						prevSlotDelta = slotDelta;
					}
				},
				stop: function(ev, ui) {
					view.trigger('eventResizeStop', this, event, ev, ui);
					if (slotDelta) {
						view.eventResize(this, event, 0, options.slotMinutes*slotDelta, ev, ui);
					}else{
						eventElement.css('z-index', 8);
						view.showEvents(event, eventElement);
						// BUG: if event was really short, need to put title back in span
					}
				}
			});
		}
	}
	
	
	
	
	/* Misc
	-----------------------------------------------------------------------------*/
	
	// get the Y coordinate of the given time on the given day (both Date objects)
	
	function timePosition(day, time) { // both date objects. day holds 00:00 of current day
		day = cloneDate(day, true);
		if (time < addMinutes(cloneDate(day), minMinute)) {
			return 0;
		}
		if (time >= addMinutes(cloneDate(day), maxMinute)) {
			return bodyContent.height();
		}
		var slotMinutes = options.slotMinutes,
			minutes = time.getHours()*60 + time.getMinutes() - minMinute,
			slotI = Math.floor(minutes / slotMinutes),
			slotTop = slotTopCache[slotI];
		if (slotTop === undefined) {
			slotTop = slotTopCache[slotI] = body.find('tr:eq(' + slotI + ') td div')[0].offsetTop;
		}
		return Math.max(0, Math.round(
			slotTop - 1 + slotHeight * ((minutes % slotMinutes) / slotMinutes)
		));
	}
	
	
	function day2col(dayOfWeek) {
		return ((dayOfWeek - Math.max(firstDay,nwe)+colCnt) % colCnt)*dis+dit;
	}
	
	
	function cellOffset(date) { // the "offset" index in the matrix
		var d = rtl ? addDays(cloneDate(view.visEnd), -1) : cloneDate(view.visStart);
		for (var i=0; i<colCnt; i++) {
			addDays(d, dis);
			if (nwe) {
				skipWeekend(d, dis);
			}
			if (d > date) {
				return i;
			}
		}
		return i;
	}
	
	
	function slotTime(dayIndex, slotIndex) { // TODO: immune to DST???
		var d = clearTime(addDays(cloneDate(view.visStart), dayIndex));
		addMinutes(d, minMinute);
		for (var i=0; i < slotIndex; i++) { // need a loop here !!!!!!!!!!!??????????
			addMinutes(d, options.slotMinutes);
		}
		return d;
	}
	
	
	// matrix building
	
	function buildMainMatrix(changeCallback) {
		var matrix = new HoverMatrix(changeCallback);
		if (options.allDaySlot) {
			matrix.row(head.find('td'));
		}
		bg.find('td').each(function() {
			matrix.col(this);
		});
		matrix.row(body);
		return matrix;
	}
	
	function buildSlotMatrix(changeCallback) {
		var matrix = new HoverMatrix(changeCallback);
		bodyTable.find('td').each(function() {
			matrix.row(this);
		});
		bg.find('td').each(function() {
			matrix.col(this);
		});
		return matrix;
	}
	
	
	// overlay for dropping and selecting
	
	function renderDayOverlay(matrix, startCol, endCol) {
		view.renderOverlay(
			matrix.rect(0, startCol, 1, endCol, head),
			head
		);
	}
	

}


// count the number of colliding, higher-level segments (for event squishing)

function countForwardSegs(levels) {
	var i, j, k, level, segForward, segBack;
	for (i=levels.length-1; i>0; i--) {
		level = levels[i];
		for (j=0; j<level.length; j++) {
			segForward = level[j];
			for (k=0; k<levels[i-1].length; k++) {
				segBack = levels[i-1][k];
				if (segsCollide(segForward, segBack)) {
					segBack.forward = Math.max(segBack.forward||0, (segForward.forward||0)+1);
				}
			}
		}
	}
}

