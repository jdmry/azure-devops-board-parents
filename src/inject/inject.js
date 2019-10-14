var DEVOPS_URL;
var DEVOPS_URL_EDIT;
var AUTH;
var ORGA;
var PROJECT;

let setupCurrentProject = () => {
	let url = window.location.pathname;
	let splitUrl = url.split('/');
	ORGA = splitUrl[1];
	PROJECT = splitUrl[2];
}

let setupConfig = (data) => {
	setupCurrentProject();

	chrome.storage.sync.get({
        username: "",
        token: ""
    }, (items) => {
		DEVOPS_URL = "https://dev.azure.com/"+ORGA+"/"+PROJECT+"/_apis/wit/workitemsbatch?api-version=5.0";
		DEVOPS_URL_EDIT = "https://dev.azure.com/"+ORGA+"/"+PROJECT+"/_workitems/edit/";
		AUTH = btoa(items.username+":"+items.token);
		loadParents(data);
	});
}

let getIdFromUrl = (url) => {
	return parseInt(url.split('/').pop());
}

let clearParents = (data) => {
	$.each(data, (index, value) => {
		$("div[data-parent='"+value.parentId+"'").remove();
	});	
}

let showParents = (data) => {
	$.each(data, (index, value) => {
		$("div[data-parent='"+value.parentId+"'").slideDown();
	});
}

let getWIColor = (type) => {
	switch (type) {
		case "Feature": return "#773b93";
		case "Epic": return "#f58924";
		case "Investigation": return "#339947";
		case "User Story": return "#009CCC";
		case "Enabler": return "#EC008C";
		case "Incident": return "#E60017";
		case "Problem": return "#E60017";
		case "Improvement": return "#339947";
		default: return "#155592";
	}
}

let getWIIcon = (type) => {
	switch (type) {
		case "Feature": return "trophy";
		case "Epic": return "crown";
		case "Investigation": return "question-circle";
		case "User Story": return "book-open";
		case "Enabler": return "cog";
		case "Incident": return "fire";
		case "Problem": return "bug";
		case "Improvement": return "chart-line";
		default: return "undo-alt";
	}
}

let renderParents = (data) => {
	clearParents(data);
	$.each(data, (index, value) => {
		wiColor = getWIColor(value.parentType);
		wiIcon = getWIIcon(value.parentType);
		let idElem = $("div.id:contains("+value.childId+")");
		let titleElem = idElem.closest("div.id-title-container");
		let parentElem = $("<div data-parent='"+value.parentId+"'></div>")
			.html("<a target='_blank' style='color: "+wiColor+" !important' href='"+DEVOPS_URL_EDIT+value.parentId+"'><i class='fas fa-"+wiIcon+"'></i> <strong>"+value.parentId+"</strong> "+value.parentName+"</a>")
			.css({"display": "none", "margin": "8px", "padding": "5px", "border-bottom": "1px solid #605E5C", "border-top": "1px solid #605E5C", "border-right": "1px solid #605E5C", "border-left": "4px solid "+wiColor});
		titleElem.after(parentElem);
	});
	showParents(data);
	chrome.runtime.sendMessage({message: "parents_loaded"}, (response) => {});
}

let generateParentsDataForRendering = (data, wiWithParents) => {
	var parentsList = [];
	$.each(wiWithParents, (index, wip) => {
		$.each(data.value, (index, pwi) => {
			if(pwi.id === wip.parentId) {
				node = {
					"childId": wip.id,
					"parentId": pwi.id,
					"parentName": pwi.fields['System.Title'],
					"parentType": pwi.fields['System.WorkItemType']
				};
				parentsList.push(node);
				return false;
			}
		});
	});
	renderParents(parentsList);
}

let fetchParentData = (data) => {
	var desiredParents = [];
	var wiWithParents = [];
	
	$.each(data.value, (index, wi) => {
		if(typeof wi.relations !== "undefined"){
			$.each(wi.relations, (index, r) => {
				if(r.attributes['name'] == "Parent") {
					let parentId = getIdFromUrl(r.url);
					if(desiredParents.indexOf(parentId) === -1)
						desiredParents.push(parentId);
					var node = {
						"id": wi.id,
						"parentId": parentId
					};
					wiWithParents.push(node);
				}
			});
		}
	});

	let queryData = {
		ids: desiredParents
	}
	$.ajax({
		url: DEVOPS_URL,
		method: "POST",
		dataType: "json",
		crossDomain: true,
		contentType: "application/json; charset=utf-8",
		data: JSON.stringify(queryData),
		cache: false,
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Authorization", "Basic " + AUTH);
		},
		success: function (data) {
			generateParentsDataForRendering(data, wiWithParents);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log(errorThrown);
			chrome.runtime.sendMessage({message: "parents_loaded"}, (response) => {});
		}
	});

	return false;
}

let fetchWIData = (idsToFetch) => {
	let queryData = {
		ids: idsToFetch,
		$expand: "Relations"
	}
	$.ajax({
		url: DEVOPS_URL,
		method: "POST",
		dataType: "json",
		crossDomain: true,
		contentType: "application/json; charset=utf-8",
		data: JSON.stringify(queryData),
		cache: false,
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Authorization", "Basic " + AUTH);
		},
		success: function (data) {
			fetchParentData(data);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log(errorThrown);
			chrome.runtime.sendMessage({message: "parents_loaded"}, (response) => {});
		}
	});
}

let loadParents = (data) => {
	var allIds = data;
	if(allIds.length === 0) {
		let allIdsElems = $("div.id");

		allIdsElems.each((index, elem) => {
			allIds.push($(elem).text());
		});
	}
	chrome.runtime.sendMessage({message: "loading_parents"}, (response) => {});
	fetchWIData(allIds);
}

chrome.runtime.onMessage.addListener((request, sender) => {
	if(request.message === "load_parents") {
		setupConfig(request.data);
	}
});
