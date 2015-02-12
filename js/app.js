window.App = {};
App.refreshTime = 3000;
App.requestMaxValue = 0;
App.bandwidthMaxValue = 0;
App.oldStats = {};
App.newStats = {};
App.backendRequests = [];
App.maxBackendResquestElements = 20;

App.getStats = function(){
	$.getJSON("/stats", function(data){
		App.oldStats = App.newStats;
		App.newStats = data;
	})
}

App.getBackendRequests = function() {
	$.getJSON("/log/1/ReqHeader/X-Full-Uri", function(data){
		var tmp_obj = {}
		$.each(data["log"], function(index, element){
			tmp_array = element["value"].split(": ");
			tmp_obj[tmp_array[1]] = tmp_obj[tmp_array[1]] ? tmp_obj[tmp_array[1]] + 1 : 1;
		})
		App.backendRequests = object_to_sorted_array(tmp_obj).slice(0,App.maxBackendResquestElements);
	})
}

App.calcHitRatio = function(){
	delta_client_req = App.newStats["MAIN.client_req"]["value"] - App.oldStats["MAIN.client_req"]["value"];
	delta_cache_hit = App.newStats["MAIN.cache_hit"]["value"] - App.oldStats["MAIN.cache_hit"]["value"];
	hitRatio = (delta_cache_hit*100)/delta_client_req;
	return Math.round(hitRatio);
}

App.calcAverageHitRatio = function(){
	hitRatio = App.newStats["MAIN.cache_hit"]["value"] * 100 / App.oldStats["MAIN.cache_hit"]["value"];
	return Math.round(hitRatio);
}

App.updateHitRatioGauge = function(){
	App.hitRatioGauge.refresh(App.calcHitRatio());
}

App.updateRequestGauge = function() {
	requests_per_second = metric_per_second("MAIN.client_req");
	if(requests_per_second > App.requestMaxValue){
		App.requestMaxValue = requests_per_second;
	}
	App.requestGauge.refresh(requests_per_second, App.requestMaxValue);
}

App.updateBandwidthGauge = function(){
	var new_bandwidth = App.newStats["MAIN.s_hdrbytes"]["value"] + App.newStats["MAIN.s_bodybytes"]["value"];
	var old_bandwidth = App.oldStats["MAIN.s_hdrbytes"]["value"] + App.oldStats["MAIN.s_bodybytes"]["value"];
	
	var actual_bandwidth_in_mega = Math.round((new_bandwidth - old_bandwidth) / 1024 / 1024);
	bandwidth_per_second = Math.round(actual_bandwidth_in_mega / (App.refreshTime / 1000));
	
	if(bandwidth_per_second > App.bandwidthMaxValue){
		App.bandwidthMaxValue = bandwidth_per_second;
	}
	App.bandwidthGauge.refresh(bandwidth_per_second, App.bandwidthMaxValue);
}

App.updateData = function(){
	App.getStats();
	App.updateHitRatioGauge();
	App.updateRequestGauge();
	App.updateBandwidthGauge();
	App.builMetricsTable("cache", App.getCacheMetrics());
	App.builMetricsTable("traffic", App.getTrafficMetrics());
	App.builMetricsTable("backend", App.getBackendMetrics());
}

App.updateBackendData = function(){
	App.getBackendRequests();
	App.buildbackendRequestTable(App.backendRequests);
}

App.getCacheMetrics = function() {
	var hits_ratio = {
		label: "Hits Ratio",
		new_value: App.calcHitRatio(),
		average_value: App.calcAverageHitRatio()
	}
	var hits_qty = {
		label: "Hits Qty.",
		new_value: nFormatter(metric_per_second("MAIN.cache_hit")),
		average_value: nFormatter(calc_average_value("MAIN.cache_hit"))
	}
	var miss_qty = {
		label: "Miss Qty.",
		new_value: nFormatter(metric_per_second("MAIN.cache_miss")),
		average_value: nFormatter(calc_average_value("MAIN.cache_miss"))
	}
	var obj_cache = {
		label: "Objs. in Cache",
		new_value: nFormatter(metric_per_second("n_object")),
		average_value: nFormatter(App.newStats["MAIN.n_object"])
	}
	return [hits_ratio, hits_qty, miss_qty, obj_cache]
}

App.getTrafficMetrics = function() {
	var new_bandwidth = App.newStats["MAIN.s_hdrbytes"]["value"] + App.newStats["MAIN.s_bodybytes"]["value"];
	var old_bandwidth = App.oldStats["MAIN.s_hdrbytes"]["value"] + App.oldStats["MAIN.s_bodybytes"]["value"];
	
	var client_conn = {
		label: "Connections",
		new_value: nFormatter(metric_per_second("MAIN.sess_conn")),
		average_value: nFormatter(calc_average_value("MAIN.sess_conn"))
	}
	var client_req = {
		label: "Requests",
		new_value: nFormatter(metric_per_second("MAIN.client_req")),
		average_value: nFormatter(calc_average_value("MAIN.client_req"))
	}
	var req_per_conn = {
		label: "Req / Conn",
		new_value: nFormatter((metric_per_second("client_req")) /(metric_per_second("client_conn")) ),
		average_value: nFormatter(App.newStats["MAIN.client_req"]["value"] / App.newStats["MAIN.client_conn"]["value"])
	}
	
	var bandwith = {
		label: "Bandwidth",
		new_value: nFormatter((new_bandwidth - old_bandwidth)/(App.refreshTime/1000)),
		average_value: nFormatter(new_bandwidth / App.newStats["MAIN.uptime"]["value"])
	}
	
	return [client_conn, client_req, req_per_conn, bandwith]
	
}

App.getBackendMetrics = function() {
	var backend_conn = {
		label: "Connections",
		new_value: nFormatter(metric_per_second("MAIN.backend_conn")),
		average_value: nFormatter(calc_average_value("MAIN.backend_conn"))
	}
	var backend_fail = {
		label: "Fails",
		new_value: nFormatter(metric_per_second("MAIN.backend_fail")),
		average_value: nFormatter(calc_average_value("MAIN.backend_fail"))
	}
	var backend_reuse = {
		label: "Reuse",
		new_value: nFormatter(metric_per_second("MAIN.backend_reuse")),
		average_value: nFormatter(calc_average_value("MAIN.backend_reuse"))
	}
	var backend_fetch = {
		label: "Fetch & Pass",
		new_value: nFormatter(App.newStats["MAIN.s_pass"]["value"] + App.newStats["MAIN.s_fetch"]["value"] - App.oldStats["MAIN.s_fetch"]["value"] - App.oldStats["MAIN.s_pass"]["value"]),
		average_value: nFormatter((App.newStats["MAIN.s_pass"]["value"] + App.newStats["MAIN.s_fetch"]["value"]) / App.newStats["MAIN.uptime"]["value"])
	}
	return [backend_conn, backend_fetch, backend_fail, backend_reuse]
}


App.builMetricsTable = function(table_id, values_object){
	var source   = $("#metrics-table-template").html();
	var context = { metric: values_object};
	var template = Handlebars.compile(source);
	var html = template(context);
	$("#"+table_id+"-metrics-table").html(html);
}

App.buildbackendRequestTable = function(value_array){
	var source   = $("#backend_request-table-template").html();
	var context = { request: value_array};
	var template = Handlebars.compile(source);
	var html = template(context);
	$("#backend_request-table").html(html);
}


$(function(){
	
	$(".slider").slider({
		min: 1,
		max: 10,
		value: App.refreshTime / 1000,
		step: 1,
		formater: function(value){
			return value-1+' s';
		}
		
	}).on('slideStop', function(ev){
		App.refreshTime = ev.value * 1000;
		clearInterval(updateBackendDataTimer);
		clearInterval(updateData);
		updateBackendDataTimer = setInterval(App.updateBackendData,App.refreshTime);
		updateData = setInterval(App.updateData,App.refreshTime);
	});
	
	App.hitRatioGauge = new JustGage({
	    id: "hit-ratio", 
	    value: 0,
	 	levelColors: ["#f70000","#f9c800","#a8d600"],
	    min: 0,
	    max: 100,
	    title: " ",
		label: "%"
	  });
	
	App.requestGauge = new JustGage({
	    id: "request-gauge", 
	    value: 0, 
	    min: 0,
	    max: 100,
	    title: " ",
		label: "per second"
	  });
	
	App.bandwidthGauge = new JustGage({
	    id: "bandwidth-gauge", 
	    value: 0, 
	    min: 0,
	    max: 100,
	    title: " ",
		levelColors: ["#40b7f1","#40b7f1","#40b7f1"],
		label: "Mbps"
	  });
	
	updateBackendDataTimer = setInterval(App.updateBackendData,App.refreshTime);
	updateData = setInterval(App.updateData,App.refreshTime);
	
});


function nFormatter(num) {
     if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'G';
     }
     if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
     }
     if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
     }
     return Math.round(num);
}

function delta_new_old_value(metric) {
	var result = App["newStats"]["MAIN"+metric] - App["oldStats"]["MAIN"+metric];
	return result;
}

function calc_average_value(metric) {
	var result = App["newStats"][metric]["value"] / App.newStats['MGT.uptime'].value;
	return result;
}

function metric_per_second(metric) {
	var divider = App.refreshTime / 1000;
	var value = delta_new_old_value(metric);
	result = Math.round(value / divider);
	return result;
}

function object_to_sorted_array(object){
	var sortable = [];
	for (var url in object){
		sortable.push([url, object[url]]);
	}
	return sortable.sort(function(a,b){return b[1] - a[1]});

}
