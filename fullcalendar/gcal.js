/*!
 * FullCalendar Google Calendar Extension
 *
 * Visit http://arshaw.com/fullcalendar/docs/#google-calendar
 * for docs and examples.
 *
 * Copyright (c) 2009 Adam Shaw
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * Date:
 * Revision:
 */
 
(function($) {

	$.fullCalendar.gcalFeed = function(feedUrl, options) {
		
		feedUrl = feedUrl.replace(/\/basic$/, '/full');
		options = options || {};
		var draggable = options.draggable || false;
		
		return function(start, end, callback) {
			$.getJSON(feedUrl + "?alt=json-in-script&callback=?",
				{
					'start-min': $.fullCalendar.formatDate(start, 'c'),
					'start-max': $.fullCalendar.formatDate(end, 'c'),
					'singleevents': true
				},
				function(data) {
					var events = [];
					if (data.feed.entry)
						$.each(data.feed.entry, function(i, entry) {
							var url;
							$.each(entry['link'], function(j, link) {
								if (link.type == 'text/html') url = link.href;
							});
							var showTime = entry['gd$when'][0]['startTime'].indexOf('T') != -1;
							events.push({
								id: entry['gCal$uid']['value'],
								url: url,
								title: entry['title']['$t'],
								start: $.fullCalendar.parseDate(entry['gd$when'][0]['startTime']),
								end: $.fullCalendar.parseDate(entry['gd$when'][0]['endTime']),
								location: entry['gd$where'][0]['valueString'],
								description: entry['content']['$t'],
								showTime: showTime,
								className: [showTime ? 'nobg' : null, options.className],
								draggable: draggable
							});
						});
					callback(events);
				});
		}
			
	}

})(jQuery);
