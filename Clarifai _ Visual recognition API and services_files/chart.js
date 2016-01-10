//(function () {
//    'use strict';

function pad(num, size) {
    var s = num + "";
    while (s.length < size) {
        s = "0" + s;
    }
    return s;
}

function seconds_to_display (seconds) {
    return pad(Math.floor(seconds / 60), 2) + ":" + pad((seconds % 60), 2);
}

function display_to_seconds(display) {
    var split = display.split(":");
    return parseInt(split[0]) * 60 + parseInt(split[1]);
}

function ChartState(rootElement, seriesData, containerID, playerID) {
    this.rootElement = rootElement;

    this.activeTime = 0;
    this.graph = "";
    this.unfiltered = [];
    this.topSeries = [];
    this.lowerSeries = [];
    this.seriesData = seriesData;
    this.containerID = containerID;
    this.playerID = playerID;

    this.selectAllOnClick = function () {
        var curObj = this;
        return function() { curObj.getSeriesSelect().multiSelect('select_all'); };
    };

    this.showTopSeries = function () {
        var curObj = this;
        return function () {
            var selectMenu = curObj.getSeriesSelect();
            selectMenu.multiSelect("select", curObj.topSeries);
            selectMenu.multiSelect("deselect", curObj.lowerSeries);
        };
    };

    this.setupOnClick = function () {

        this.rootElement.find('.selectAllButton').click(this.selectAllOnClick());
        this.rootElement.find('.resetButton').click(this.showTopSeries());
    };


    this.getSeriesSelect = function () {
        return this.rootElement.find('.series-select');
    };

    this.setupSelector = function (rank_thresh) {
        this.rootElement.find(".controls").show();

        var select = this.getSeriesSelect();
        var parent = this;
        select.multiSelect({
            keepOrder: true,
            afterSelect: function (values) {
                parent.toggleSeries(values, "add");
            },
            afterDeselect: function (values) {
                if (parent.graph.series.length > 1) {
                    parent.toggleSeries(values, "drop");
                }
                else {
                    //prevent deselecting all trends, messes up rickshaw graph
                    select.multiSelect("select", values);
                }
            }
        });

        var seriesCuml = this.rankSeries(this.unfiltered, null);
        for (var i = 0; i < seriesCuml.length; i++) {
            var hash = {};
            hash.value = seriesCuml[i].name;
            hash.text = seriesCuml[i].name;
            select.multiSelect("addOption", hash);

            if (i < rank_thresh) {
                select.multiSelect("select", seriesCuml[i].name);
                this.topSeries.push(seriesCuml[i].name);
            }
            else {
                this.lowerSeries.push(seriesCuml[i].name);
            }
        }
    };

    this.findTag = function (series, tag) {
        for (var i = 0; i < series.length; i++) {
            if (series[i].name === tag) {
                return i;
            }
        }
        return -1;
    };

    this.toggleSeries = function (tags, action) {
        //common case of "select all", "deselect all"
        if (action === "add" && tags.length + this.graph.series.length >= this.unfiltered.length) {
            this.resetSeries(this.graph);
            this.graph.update();
        }
        else if (action === "drop" && tags.length === this.graph.series.length) {
            this.overwriteSeries(this.graph.series, []);
            this.graph.update();
        }


        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var series = this.graph.series;
            var newSeries = [];

            var index = this.findTag(series, tag);

            if (action === "add" && index < 0) {
                var addSeries = this.unfiltered[this.findTag(this.unfiltered, tag)];
                this.overwriteSeries(newSeries, series);
                newSeries.push(addSeries);
                this.overwriteSeries(series, newSeries);
                this.graph.update();
            }
            else if (action === "drop" && index >= 0 && index < series.length) {
                this.overwriteSeries(newSeries, series);
                newSeries.splice(index, 1);
                this.overwriteSeries(series, newSeries);
                this.graph.update();
            }
        }

    };

    this.resetSeries = function (graph) {
        this.overwriteSeries(graph.series, this.unfiltered);
    };


    this.rankSeries = function (series, interval) {
        var seriesCuml = [];
        for (var i = 0; i < series.length; i++) {
            var trend = series[i];
            var tag = trend.name;
            var data = trend.data;

            var cumlConf = 0;

            for (var j = 0; j < data.length; j++) {
                var time = data[j].x;
                var conf = data[j].y;

                // if (interval !== null && !(interval["start"] <= time && interval["end"] >= time)){
                if (interval !== null && !(interval.start <= time && interval.end >= time)) {
                    continue;
                }

                cumlConf += conf;
            }

            seriesCuml.push({"name": tag, "cuml": cumlConf});

        }

        seriesCuml.sort(function (a, b) {
            //higher cumulative values are given lower indices
            return b.cuml - a.cuml;
        });

        return seriesCuml;
    };

    this.filterCumlRank = function (series, interval, rank_thresh) {
        //rank, starting from 0, strictly less than rank_thresh
        var seriesCuml = this.rankSeries(series, interval);

        var topRankedTags = {};

        for (var i = 0; i < Math.min(rank_thresh, seriesCuml.length); i++) {
            topRankedTags[seriesCuml[i].name] = true;
        }

        return this.filterSeries(series, interval, topRankedTags, null, null);

    };

    this.filterSeries = function (series, interval, allowed_tags, conf_thresh, cuml_thresh) {
        //refactor as dict of arguments
        var filtered_series = [];

        for (var i = 0; i < series.length; i++) {
            var trend = series[i];
            var tag = trend.name;
            var data = trend.data;
            var filtered_data = [];

            var cuml_conf = 0;

            if (allowed_tags !== null && allowed_tags[tag] !== true) {
                //allowed_tags is dict containing true, false or else undefined over strings
                continue;
            }

            for (var j = 0; j < data.length; j++) {
                var time = data[j].x;
                var conf = data[j].y;
                cuml_conf += conf;

                //if (interval !== null && !(interval["start"] <= time && interval["end"] >= time)){

                if (interval !== null && !(interval.start <= time && interval.end >= time)) {
                    continue;
                }

                if (conf_thresh !== null && conf <= conf_thresh) {
                    continue;
                }
                filtered_data.push({"x": time, "y": conf});
            }

            if (cuml_thresh !== null && cuml_conf <= cuml_thresh) {
                continue;
            }

            if (filtered_data.length > 0) {
                var filtered_trend = {};

                filtered_trend.data = filtered_data;
                filtered_trend.name = trend.name;
                filtered_trend.color = trend.color;
                filtered_series.push(filtered_trend);
            }
        }

        return filtered_series;
    };

    this.overwriteSeries = function (target_series, new_series){
        for (var i = 0; i < new_series.length; i++){
            if (i < target_series.length){
                target_series[i] = new_series[i];
            }
            else{
                target_series.push(new_series[i]);
            }
        }

        while(target_series.length > new_series.length){
            target_series.pop();
        }
    };

    this.filterNice = function (graph, cuml_thresh) {
        this.overwriteSeries(graph.series, this.filterSeries(graph.series, null, null, null, cuml_thresh));
        graph.update();
    };

    this.resetNice = function (graph) {
        this.resetSeries(graph);
        graph.update();
    };

    this.setupGraph = function (rank_thresh) {
        var curObj = this;  // I have no idea why this keeps changing scope.

        curObj.graph = new Rickshaw.Graph({
            element: curObj.rootElement.find(".chart")[0],
            //width: curObj.rootElement.find(".video").width(),
            height: 200,
	    min: "auto",
	    // min: 0.8,
            renderer: "line",
            interpolation: "cardinal",
            stroke: true,
            series: curObj.seriesData,
            stack: false
        });

        curObj.overwriteSeries(curObj.unfiltered, curObj.seriesData);

        var slider = new Rickshaw.Graph.RangeSlider.Preview({
            graph: curObj.graph,
            element: curObj.rootElement.find(".slider")[0],
            //width: curObj.rootElement.find(".video").width(),
            height: 70,
	    min: "auto",
        });

        curObj.overwriteSeries(
            curObj.graph.series,
            curObj.filterCumlRank(curObj.graph.series, null, rank_thresh));

        curObj.graph.render();

        var hoverDetail = new Rickshaw.Graph.HoverDetail({
            graph: curObj.graph,
            formatter: function(series, x, y ) {
                return series.name;
            },
            xFormatter: seconds_to_display,
            onShow: function () {
                var x_label = curObj.rootElement.find('.x_label');
                curObj.activeTime = display_to_seconds(x_label.text());
            }
        });


        var time = new Rickshaw.Fixtures.Time();
        var minutes = time.unit('minute');
        var xAxis = new Rickshaw.Graph.Axis.Time({
            graph: curObj.graph
            //timeUnit: minutes
        });

        xAxis.render();

        $(window).resize(function () {
            var jwPlayerWidth = curObj.rootElement.find(".video").width();

            curObj.graph.configure({
                width: jwPlayerWidth,
                height: curObj.graph.height,
		min: "auto",
		//min: 0.8,
            });
            curObj.graph.render();

            slider.configure({
		width: jwPlayerWidth,
		min: "auto",
	    });
            slider.render();
        });

        curObj.setupSelector(rank_thresh);

        //jwplayer(curObj.playerID).onSeek(function () {
        //    //onSeek is buggy, difficult to let video remain paused
        //    if (playState != "PLAYING"){
        //     jwplayer("video").pause(true);
        //     }
        //});

        var chart_container = curObj.rootElement.find('.chart_container');
        chart_container.click(function () {
            //playState = jwplayer("video").getState();
            jwplayer(curObj.playerID).seek(curObj.activeTime);
        });

        chart_container.dblclick(function () {
            jwplayer(curObj.playerID).play();
        });

        return curObj.graph;
    };

    /*super hacky, often leads to stuck mousedown, clicks without dragging do not work
     var mouseDown = 0;

     $(document).ready(function(){
     document.body.onmousedown = function() {
     ++mouseDown;
     }
     document.body.onmouseup = function() {
     --mouseDown;
     }
     });

     var prevState = "PAUSED";
     */
}
//})();
