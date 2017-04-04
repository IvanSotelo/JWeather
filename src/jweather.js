/**
 * jQuery Plugin - JWeather v@VERSION
 * A jQuery plugin used to display the current weather of any city using Yahoo-Weather.
 * Dependencies: jQuery, YahooWeather API
 * Date Created: February 15, 2017
 * Licensed under the MIT license
 *
 * Copyright (c) 2017 Ivan Sotelo
 * http://deskode.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 *
 * Build Date: @DATE
 *
 */
;(function ( $, window, document, undefined ) {

		
		var pluginName = "jweather";

		// Create the defaults once
	    var defaults = {
				location: "Waterloo, ON", //city, region
				forecast: 5, //number of days to forecast, max 5
				view : "full", //options: simple, today, partial, forecast, full
				render : true, //render: false if you to make your own markup, true plugin generates markup
				//units : "metric" or "imperial" default: "auto"
			};

		var apiurls = {
			"yahoo" : ["https://query.yahooapis.com/v1/public/yql"]
		};

		// Plugin Constructor
		function Plugin (element, options ) {

			this.element = element;

			// jQuery has an extend method which merges the contents of two or
			// more objects, storing the result in the first object. The first object
			// is generally empty as we don't want to alter the default options for
			// future instances of the plugin
			this.settings = $.extend( {}, defaults, options );
			
			//bound forecast to max of 5 days, api won't return more then that
			this.settings.forecast = Math.min(this.settings.forecast, 5); 
			
			//store plugin name for local reference
			this._name = pluginName;
			
			this.once = false;
			
			//call initilizaiton
			this.init();
		};

		// Avoid Plugin.prototype conflicts
		$.extend(Plugin.prototype, {
			init: function () {
				//if you want the pluging to render markup init will do all the work
				//otherwise you are on your own
				if (this.settings.render) {

					this.fetchWeather().then(this.render, this.error);
					
				}
				this.once = true; //init has happened, can be used to prevent some init tasks happening again
			},
			fetchWeather: function () {
				//Fetches the weather from the API with an ajax request
				//Returns a promise of (weather object, this)

				//scope of this for nested functions
				var that = this;

				//create promise
				var promise = new $.Deferred();


				//data params to send along with each ajax request
				//array because some apis may require multiple requests
				//params[0] is sent to apiurls[api][0] and so on
				var params = []; 

				//build location query string
				var location = this.settings.location;

				
					//yahoo weather uses c and f for metric/imperial unit identifiers,
					//convert our stored text string to match what they expect
					var u = (this.settings.units == "metric")?"c":"f";
					
					//see yahoo yql weather api for details on params passed to api
					var parameters = {}; 
					parameters.q = "select * from weather.forecast where woeid in (select woeid from geo.places(1) where text='" + location + "') AND u='" + u +"'";
					parameters.env = "store://datatables.org/alltableswithkeys"; //some sort of api version info... because yahoo.
					parameters.format = "json";
					params.push(parameters);

				//for each request send the associated paramaters, then when all are done render all data
				var requests = []; //requests sent
				//for each url in apiurls for the api set, send the associated params to it in an ajax request
				for (var i = 0; i < apiurls['yahoo'].length; i++) {
					//jquery ajax request promise
					requests.push($.get(apiurls['yahoo'][i], params[i]));
				}

				//when all request promises are done
				$.when.apply(this, requests)
		    	.done(function(){
		    		
		    		//grab the result from the promise as passed by arguments 
		    		//and convert it to an actual array with slice
		    		var args = Array.prototype.slice.call(arguments);

					//remove a layer of nesting for easier use
					 //the [0] element is the result, the rest of the array is
					 //info about the ajax request and promise that we can toss
					if (requests.length > 1) {
						//if multiple requests, each promise result of the ajax request is part of an array
						args = args.map(function(val) { return val[0]});
					}
					else {
						args = args[0];
					}
				

 					if (args.query.count == 0 || args.query.results.channel.description == "Yahoo! Weather Error") {
						//yahoo weather really should return a better error checking method.
						console.log("Error interacting with the yahoo api see error object below for details:");
						console.log(args);
						promise.reject(args, that);
					}
					else {

						//now take that fancy api data and map it to a common format with datamapper function
						var weather = datamapper(args, that.settings);
						
						that._weather = weather; //store it on the instance

						$.data( that.element, "weather", weather); //and store it on the DOM for general use
						
						promise.resolve(weather, that);

					}


		    	})
				.fail(function(error){  	
					//TODO draw fails.
					console.log("fail");
					promise.reject(error, that);
				 });

				return promise;

			},
			error : function(error, context) {

				if (!context) {
					//if called directly and not via plugin we need to set context to this vs passed when a promise
					context = this;
				}
				
					if (error.query.results) {
						error = "Error: " + error.query.results.channel.item.title + ". See console log for details.";
					}
					else {
						error = "Error: no results. See console log for details.";
					}

				var div = $("<div/>", {"class": "weather-widget " + context.settings.view});
				$("<h2/>").text("Error").appendTo(div);
				$("<p/>").text(error).appendTo(div);
				$(context.element).html(div); //recall that this.element is set in plugin constructor
				return $(context.element);
			},
			//Generates the DOM elements
			render : function (weather, context) {

				if (!context) {
					//if called directly and not via plugin we need to set context to this vs passed when a promise
					context = this;
					weather = this._weather;
				}

				//string showing degree symbol + F or C
				var degrees = context.settings.units == "metric"?"&#176;C":"&#176;F";

				//Now that we have everything lets make a dom fragment of our data.
				//Then append that fragment once to the dom once its all made.
				//There is a bunch of if switches for various view options but this
				//is mostly self-explainatory dom generating code from the weather object
				var widget = $("<div/>", {"class": "weather-widget " + context.settings.view});
				var pstblock = $("<div/>", {"class": "pst-block"}).appendTo(widget);
				var pstblockhead = $("<div/>", {"class": "pst-block-head"}).appendTo(pstblock);
				var pstblockmain = $("<div/>", {"class": "pst-block-main"}).appendTo(pstblock);
				var title = $("<h2/>", {"class": "title-4"}).appendTo(pstblockhead);
				var location='<strong><i class="li_location"></i> '+weather.location+'</strong>';
				title.append(location);
				
				if (context.settings.view != "forecast") {			
					var weatherblock = $("<div/>", {"class": "weather-block"});
					var temperature = $("<div/>", {"class": "temperature"});
					$("<i/>", {"class" : weather.today.code}).appendTo(temperature);
					$("<span/>", {"class" : "degrees-1"}).html(weather.today.temp.now + "<sup>" + degrees + "</sup>").appendTo(temperature);
					$("<div/>", {"class": "day"}).text(weather.today.day).appendTo(temperature);
					temperature.appendTo(weatherblock);
					weatherblock.appendTo(pstblockmain);	
					var hr = $("<hr/>",{"class": "pst-block-hr"}).appendTo(pstblockmain);
				}

				if (context.settings.view != "simple") {
						var detail = $("<ul/>");
						$("<li/>").html("Humedad " + weather.today.humidity + "%").appendTo(detail);
						$("<li/>").html("Viento " + formatWind(weather.today.wind.speed, weather.today.wind.deg, context.settings.units)).appendTo(detail);
						$("<li/>").html("H " + weather.today.temp.max + "<sup>" + degrees + "</sup>" + " L " + weather.today.temp.min + "<sup>" + degrees + "</sup>").appendTo(detail);
						
						detail.appendTo(weatherblock);


					if (context.settings.view != "today" || context.settings.view == "forecast") {
						var weatherdays = $("<div/>", {"class": "weather-days"});
						var weatherdayslist = $("<ul/>", {"class": "weather-days-list"});
						var startingIndex = (context.settings.view == "forecast")?0:1;
						//index should include today for forecast view exclude for other views
						for (var i = startingIndex; i < weather.forecast.length; i++) {
							var day = $("<li/>").appendTo(weatherdayslist);
							$("<span/>", {"class": "degrees-2"}).html(weather.forecast[i].temp.max + "<i class='degrees-ic-2'></i>").appendTo(day);
							$("<div/>", {"class" : "day"}).html(weather.forecast[i].day).appendTo(day);						
						}
						weatherdayslist.appendTo(weatherdays);
						weatherdays.appendTo(pstblockmain);
					}
				}

 
				//now append our dom fragment to the target element
				$(context.element).html(widget); //recall that this.element is set in plugin constructor

				return $(context.element);

			}

		});
 

		//jQuery Constructor
		// A lightweight plugin wrapper on the jquery fn constructor,
		// preventing against multiple instantiations on the same element
		$.fn[pluginName] = function ( options, args ) {
			if ($.isFunction(Plugin.prototype[options])) {
				//enable function access via .flatWeatherPlugin('function', 'args')
				//grab the plugin instance from the dom reference and call function with any args
				//return the results of the  
				return this.data("plugin_" + pluginName)[options](args);
			}
			//return this for jquery chainability
			return this.each(function() {
				//check if plugin has been attached to the dom
				if (!$.data(this, "plugin_" + pluginName)) {
					var plugin = new Plugin(this, options); //call constructor
					return $.data(this, "plugin_" + pluginName, plugin); //attach plugin instance to the dom data
				}
			});
		};

		function datamapper (input, settings) {

			var out = {}; //map input to out
			
				//key = yahoo code, value = standard code (based on openweathermap codes)
				var codes = {
					0  : "900",	//tornado
					1  : "weather-icon-windy-rain",	//tropical storm
					2  : "weather-icon-windy-rain2",	//hurricane
					3  : "weather-icon-clouds-flash",	//severe thunderstorms
					4  : "weather-icon-cloud-flash-alt",	//thunderstorms
					5  : "weather-icon-snow",	//mixed rain and snow
					6  : "weather-icon-rain",	//mixed rain and sleet
					7  : "weather-icon-rain",	//mixed snow and sleet
					8  : "weather-icon-drizzle",	//freezing drizzle
					9  : "weather-icon-drizzle",	//drizzle
					10 : "weather-icon-rain",	//freezing rain
					11 : "weather-icon-rain",	//showers
					12 : "weather-icon-rain",	//showers
					13 : "weather-icon-snow-heavy",	//snow flurries
					14 : "weather-icon-snow",	//light snow showers
					15 : "weather-icon-snow",	//blowing snow
					16 : "weather-icon-snow-heavy",	//snow
					17 : "weather-icon-hail",	//hail
					18 : "weather-icon-rain",	//sleet
					19 : "weather-icon-mist",	//dust
					20 : "weather-icon-fog-sun",	//foggy
					21 : "weather-icon-fog-cloud",	//haze
					22 : "weather-icon-fog",	//smoky
					23 : "weather-icon-wind",	//blustery
					24 : "weather-icon-windy",	//windy
					25 : "weather-icon-snowflake",	//cold
					26 : "weather-icon-clouds",	//cloudy
					27 : "weather-icon-clouds",	//mostly cloudy (night)
					28 : "weather-icon-clouds",	//mostly cloudy (day)
					29 : "weather-icon-cloud-moon",	//partly cloudy (night)
					30 : "weather-icon-cloud-sun",	//partly cloudy (day)
					31 : "weather-icon-moon",	//clear (night)
					32 : "weather-icon-sun",	//sunny
					33 : "weather-icon-moon",	//fair (night)
					34 : "weather-icon-sun",	//fair (day)
					35 : "weather-icon-hail",	//mixed rain and hail
					36 : "weather-icon-temperature",	//hot
					37 : "weather-icon-windy-rain",	//isolated thunderstorms
					38 : "weather-icon-windy-rain",	//scattered thunderstorms
					39 : "weather-icon-windy-rain",	//scattered thunderstorms
					40 : "weather-icon-rain",	//scattered showers
					41 : "weather-icon-snow-heavy",	//heavy snow
					42 : "weather-icon-snow-alt",	//scattered snow showers
					43 : "weather-icon-snow-heavy",	//heavy snow
					44 : "weather-icon-cloud",	//partly cloudy
					45 : "weather-icon-clouds-flash",	//thundershowers
					46 : "weather-icon-snow-heavy",	//snow showers
					47 : "weather-icon-cloud-flash-alt",	//isolated thundershowers
				   3200: "weather-icon-na",	//not available... alright... lets make that sunny.
				}

				input = input.query.results.channel; //get rid of a bunch of silly yahoo nested objects;
				
				out.location =  input.location.city + ", " + input.location.country;
				out.city = input.location.city;

				out.today = {};
				out.today.temp = {};
				out.today.temp.now = Math.round(input.item.condition.temp);
				out.today.temp.min = Math.round(input.item.forecast[0].low);
				out.today.temp.max = Math.round(input.item.forecast[0].high);

				out.today.desc = input.item.condition.text.capitalize();
				out.today.code = codes[input.item.condition.code]; //map weather code

				out.today.wind = {};
				out.today.wind.speed = input.wind.speed;
				out.today.wind.deg = input.wind.direction;
				out.today.humidity = input.atmosphere.humidity;
				out.today.pressure = input.atmosphere.pressure;
				out.today.sunrise = input.astronomy.sunrise.toUpperCase();
				out.today.sunset = input.astronomy.sunset.toUpperCase();

				out.today.day = getDayString(new Date());
				
				out.forecast = [];
				//grab only the number of forecast days desired from settings
				for (var i = 0; i <= settings.forecast ; i++) {
					var forecast = {};
					forecast.day = getDayString(new Date(input.item.forecast[i].date));
					forecast.code = codes[input.item.forecast[i].code]; //map weather code
					forecast.desc = input.item.forecast[i].text.capitalize();
					forecast.temp = {max: Math.round(input.item.forecast[i].high), min: Math.round(input.item.forecast[i].low)}
					out.forecast.push(forecast);
				}

			return out;

		};

		//Helpers
		String.prototype.capitalize = function() {
		    return this.charAt(0).toUpperCase() + this.slice(1);
		};

		//take a date object and return a day string
		function getDayString(date) {
		  return ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'][date.getDay()];
		};

		//converts and epoch time in seconds to hours in the day
		function epochToHours(date) {
		  date = new Date(date * 1000);
		  var hours =  date.getHours();
		  var minutes = date.getMinutes();
		  var ampm = hours >= 12 ? 'PM' : 'AM';
		  hours = hours % 12;
		  hours = hours ? hours : 12; // the hour '0' should be '12'
		  minutes = minutes < 10 ? '0'+minutos : minutes;
		  var strTime = hours + ':' + minutes + ' ' + ampm;
		  return strTime;
		};

		//Takes wind speed, direction in degrees and units 
		//and returns a string ex. (8.5, 270, "metric") returns "W 8.5 km/h"
		function formatWind(speed, degrees, units) {
			var wd = degrees;
			if ((wd >= 0 && wd <= 11.25) || (wd > 348.75 && wd <= 360))  {
				wd = "N";
			}
			else if (wd > 11.25 && wd <= 33.75){
				wd = "NNE";
			}
			else if (wd > 33.75 && wd <= 56.25){
				wd = "NE";
			}
			else if (wd > 56.25 && wd <= 78.75){
				wd = "ENE";
			}
			else if (wd > 78.75 && wd <= 101.25){
				wd = "E";
			}
			else if (wd > 101.25 && wd <= 123.75){
				wd = "ESE";
			}
			else if (wd > 123.75 && wd <= 146.25){
				wd = "SE";
			}
			else if (wd > 146.25 && wd <= 168.75){
				wd = "SSE";
			}
			else if (wd > 168.75 && wd <= 191.25){
				wd = "S";
			}
			else if (wd > 191.25 && wd <= 213.75){
				wd = "SSW";
			}
			else if (wd > 213.75 && wd <= 236.25){
				wd = "SW";
			}
			else if (wd > 236.25 && wd <= 258.75){
				wd = "WSW";
			}
			else if (wd > 258.75 && wd <= 281.25){
				wd = "W";
			}
			else if (wd > 281.25 && wd <= 303.75){
				wd = "WNW";
			}
			else if (wd > 303.75 && wd <= 326.25){
				wd = "NW";
			}
			else if (wd > 326.25 && wd <= 348.75){
				wd = "NNW";
			}
			var speedUnits = (units == "metric")?"km/h":"mph";
			return speed + " " + speedUnits + " " + wd;
		};


})( jQuery, window, document );