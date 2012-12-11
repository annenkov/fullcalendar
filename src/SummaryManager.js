function SummaryManager(options, element) {
	var t = this;
          
        // exports
        t.fetchSummary = fetchSummary;
        t.renderSummary = renderSummary;
              
        /* Summary fetcher & renderer 
        -----------------------------------------------------------*/

        function fetchSummary() {
            var summary = options['summary'];
            if (summary == undefined) { summary = []; }
            var fetchedSummary = [];
            if ($.isFunction(summary)) {
                summary.call(t, renderSummary);
            } else {
                fetchedSummary = renderSummary(summary);
            }            
        }        

        function renderSummary(summary) {
            var summaryByResourceId = {};     
            $.each(summary, function(index, value) {
                    summaryByResourceId[value.resource] = value;
            });

            var summaryCells = element.find('td.fc-summary');
            $.each(summaryCells, function (index, value) {
                var cell = $(value);
                var resourceId = summaryByResourceId[cell.data('resource')];
                if (resourceId != undefined) {
                    cell.html(summaryByResourceId[cell.data('resource')]['contents']);
                }
            });
            
        }
}
