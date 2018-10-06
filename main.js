(function() {

	var webPage = require('webpage');
	var system = require('system');
	var args = system.args;
	var page = webPage.create();
	page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36';
	page.settings.javascriptEnabled = true;
	page.settings.loadImages = false; // Script is much faster with this field set to false
	phantom.cookiesEnabled = true;
	phantom.javascriptEnabled = true;
	console.log('All settings loaded, start with execution');


	var aurionHomePageAccess = function(){
		console.log('Step 1 - Open Aurion home page');
		page.open("https://aurion-lille.yncrea.fr", function(status){});
		page.onLoadFinished = function() {
			aurionConnection();
		};
	};

	var aurionConnection = function() {
		console.log('Step 2 - Populate and submit the login form');
		page.evaluate(function(args){
			document.getElementById("username").value=args[1];
			document.getElementById("password").value=args[2];
			document.getElementById("formulaireSpring").submit();
		}, args);
		page.onLoadFinished = function() {
			aurionScheduleAccess();
		};
	};

	var aurionScheduleAccess = function() {
		console.log('Step 3 - Click on the schedule button');
		page.evaluate(function(){
			var scheduleButton = $('a:contains("Mon Planning")');
			scheduleButton.click(); 
		});
		page.onLoadFinished = function() {
			// Wait of 5s to allow the page to be fully loaded
			window.setTimeout(function() {
				aurionExtractData();
			}, 5000);
		};
	};

	var aurionExtractData = function() {
		console.log('Step 4 - Extract data from the schedule page');
		var cookie = page.cookies[0].value;
		var result = page.evaluate(function(cookie) {
			var schedule = document.getElementsByClassName('schedule')[0].getAttribute('id');
			var viewState = document.getElementsByName('javax.faces.ViewState')[0].getAttribute('value');
			var useful_data = "schedule : "+schedule+"\nviewState : "+viewState+"\ncookie : "+cookie;
			var useful_data = [schedule, viewState, cookie];
			return useful_data;
		}, cookie);
		aurionGetDate(result);
	};

	var aurionGetDate = function(scheduleArgs) {
		console.log('Step 5 - Get json data for the week/month from the schedule page');
		var formId = scheduleArgs[0];
		var viewState = scheduleArgs[1];
		var start = (+ new Date(2018,9,1));
		var end = (+ new Date(2018,9,7));
		var postBody = 'javax.faces.partial.ajax=true'
		+'&javax.faces.source='+formId
		+'&javax.faces.partial.execute='+formId
		+'&javax.faces.partial.render='+formId
		+'&'+formId+'='+formId
		+'&'+formId+'_start='+start
		+'&'+formId+'_end='+end
		+'&'+formId+'_view=agendaWeek'
		+'&form=form&form:largeurDivCenter=1606&form:offsetFuseauNavigateur=-7200000'
		+'&form:onglets_activeIndex=0&onglets_scrollState=0&javax.faces.ViewState='+viewState;

		page.open('https://aurion-lille.yncrea.fr/faces/Planning.xhtml', 'POST', postBody, function(status) {
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(page.content,"text/xml");
			data = xmlDoc.getElementById('form:j_idt121').innerHTML;
			jsonData = data.replace("<![CDATA[", "").replace("]]>", "");
			jsonData = JSON.stringify(JSON.parse(jsonData), null, '\t'); // just for indent the JSON
			var fs = require('fs');
			fs.write('response.json', jsonData, 'w');
			console.log("Test complete");
		});

		page.onLoadFinished = function() {
			phantom.exit();
		};
	};

	aurionHomePageAccess();

})();