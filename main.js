(function() {
	/*
	**	Settings
	*/
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


	/*
	**	Regular JS function
	*/
	var convertDate = function(dateString) {
		var dateSplit = dateString.split('-');
		var dateObj = new Date();
		dateObj.setFullYear(parseInt(dateSplit[0]), parseInt(dateSplit[1])-1, parseInt(dateSplit[2])); // js month start from 0 to 11
		dateObj.setHours(0, 0, 0, 0);
		return (+ dateObj); // return the date in timestamp
	};

	var getMonday = function(d) {
		d = new Date(d);
		var day = d.getDay();
		var diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
		var returnDate = new Date(d.setDate(diff));
		returnDate.setHours(0, 0, 0, 0);
		return +(returnDate); // return the date in timestamp
	}

	var getSundayFromMonday = function(d) {
		d = new Date(d);
		var day = d.getDay();
		var diff = d.getDate() + 6;
		var returnDate = new Date(d.setDate(diff));
		returnDate.setHours(0, 0, 0, 0);
		return +(returnDate); // return the date in timestamp
	}

	/*
	**	PhantomJS functions
	*/
	var aurionHomePageAccess = function(){
		console.log('Step 1 - Open Aurion home page');
		page.open("https://aurion-lille.yncrea.fr", function(status){
			if(status !== 'success') {
				console.log('Erreur : Impossible d\'accéder à Aurion');
				phantom.exit();
			}
		});
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
			if(page.url === 'https://aurion-lille.yncrea.fr/erreur.html') {
				console.log('Erreur : login/mdp incorrect');
				phantom.exit();
			} else {
				aurionScheduleAccess();
			}
		};
	};

	var aurionScheduleAccess = function() {
		console.log('Step 3 - Click on the schedule button');
		page.evaluate(function(){
			var scheduleButton = $('a:contains("Mon planning")');
			scheduleButton.click(); 
		});
		page.onLoadFinished = function() {
			if(page.url !== 'https://aurion-lille.yncrea.fr/faces/Planning.xhtml') {
				console.log('Erreur : Impossible d\'accéder au planning');
				phantom.exit();
			} else {
				// Wait of 1ms
				window.setTimeout(function() {
					aurionExtractData();
				}, 1);
			}
		};
	};

	var aurionExtractData = function() {
		console.log('Step 4 - Extract data from the schedule page');
		var result = page.evaluate(function() {
			var schedule = document.getElementsByClassName('schedule')[0].getAttribute('id');
			var viewState = document.getElementsByName('javax.faces.ViewState')[0].getAttribute('value');
			var useful_data = [schedule, viewState];
			return useful_data;
		});
		aurionGetData(result);
	};

	var aurionGetData = function(scheduleArgs) {
		console.log('Step 5 - Get json data for the week from the schedule page');
		var formId = scheduleArgs[0];
		var viewState = scheduleArgs[1];
		var date = args[3];
		var start = getMonday(date);
		var end = getSundayFromMonday(start);
		var postBody = 'javax.faces.partial.ajax=true'
		+'&javax.faces.source='+formId
		+'&javax.faces.partial.execute='+formId
		+'&javax.faces.partial.render='+formId
		+'&'+formId+'='+formId
		+'&'+formId+'_end='+end
		+'&'+formId+'_start='+start
		+'&'+formId+'_view=agendaWeek'
		+'&form=form&form:largeurDivCenter=1606&form:offsetFuseauNavigateur=-7200000'
		+'&form:onglets_activeIndex=0&onglets_scrollState=0&javax.faces.ViewState='+viewState;

		var jsonData;

		page.open('https://aurion-lille.yncrea.fr/faces/Planning.xhtml', 'POST', postBody, function(status) {
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(page.content,"text/xml");
			var data = xmlDoc.getElementById('form:j_idt121').textContent;
			jsonData = data.replace("<![CDATA[", "").replace("]]>", ""); // JSON
			jsonData = JSON.parse(jsonData); // JS Object
			jsonData['settings'] = {"userID" : args[1], "start" : start, "end": end, };
			jsonData = JSON.stringify(jsonData, null, '\t'); // JSON indented
		});

		page.onLoadFinished = function() {
			if(!jsonData || jsonData === "") {
				console.log('Erreur : Données de retour vide (problème de dates ?)');
				phantom.exit();
			} else {
				var fs = require('fs');
				fs.write('response.json', jsonData, 'w');
				console.log("Test complete");
				phantom.exit();
			}
		};
	};

	aurionHomePageAccess();

})();