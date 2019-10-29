var DEVOPS_URL;
var DEVOPS_URL_EDIT;
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
        remainingItems: false
    }, (items) => {
		DEVOPS_URL = "https://dev.azure.com/"+ORGA+"/"+PROJECT+"/_apis/wit/workitemsbatch?api-version=5.1";
		DEVOPS_URL_EDIT = "https://dev.azure.com/"+ORGA+"/"+PROJECT+"/_workitems/edit/";
		loadParents(data);
	});
}

let getIdFromUrl = (url) => {
	return parseInt(url.split('/').pop());
}

let sendLoadedMessage = () => {
	chrome.runtime.sendMessage({message: "loaded"}, (response) => {});
}

let clearParents = (data) => {
	$.each(data, (index, value) => {
		$("div[data-parent='"+value.parentId+"'").remove();
	});
	sendLoadedMessage();
}

let showParents = (data) => {
	$.each(data, (index, value) => {
		$("div[data-parent='"+value.parentId+"'").slideDown();
	});
	sendLoadedMessage();
}

let clearChildren = (parentId, childId) => {
	$("ul[data-children='"+parentId+"-"+childId+"']").remove();
	sendLoadedMessage();
}

let showChildren = (parentId, childId) => {
	$("ul[data-children='"+parentId+"-"+childId+"']").slideDown();
	sendLoadedMessage();
}

let getWIColor = (type) => {
	switch (type) {
		case "Feature": return "#b070ce";
		case "Epic": return "#f58924";
		case "Investigation": return "#339947";
		case "User Story": return "#009CCC";
		case "Enabler": return "#EC008C";
		case "Incident": return "#E60017";
		case "Problem": return "#E60017";
		case "Improvement": return "#339947";
		case "Product Backlog Item": return "#009CCC";
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
		case "Product Backlog Item": return "list";
		default: return "undo-alt";
	}
}

let renderChildren = (parentId, childId, data) => {
	clearChildren(parentId, childId);
	var childrenUl = /*data.doneItems+"\/"+data.items+"<br />*/"<ul style='font-size: smaller;margin-top: 2px; margin-left: 14px; display:none' data-children='"+parentId+"-"+childId+"'>";
	$.each(data.nodes, (index, value) => {
		let childColor = getWIColor(value.type);
		let childIcon = getWIIcon(value.type);
		let display = value.state === "Done" ? "<del>"+value.name+"</del>" : value.name;
		childrenUl += "<li style='list-style-type: decimal; color:"+childColor+" !important'><i class='fas fa-"+childIcon+"'></i> <a style='text-decoration:none' target='_blank' href='"+value.url+"'>"+display+"</a></li>";
	});
	childrenUl += "</ul>";
	childrenElem = $(childrenUl);
	$('div[data-child="'+childId+'"]').append(childrenElem);
	showChildren(parentId, childId);
}

let getChildrenForParents = (parentChildId) => {
	console.log(parentChildId);
	let parentId = parentChildId.split('-')[0];
	let currentChildId = parentChildId.split('-')[1];
	if($("ul[data-children='"+parentChildId+"']").length) {
		clearChildren(parentId, currentChildId);
		return false;
	}
	let parentQueryData = {
		ids: [parentId],
		$expand: "Relations"
	}
	$.ajax({
		url: DEVOPS_URL,
		method: "POST",
		dataType: "json",
		crossDomain: true,
		contentType: "application/json; charset=utf-8",
		data: JSON.stringify(parentQueryData),
		cache: false,
		success: function (parent) {
			parent = parent.value[0];
			var parentChildren = [];
			if(typeof parent.relations !== "undefined"){
				$.each(parent.relations, (index, r) => {
					if(r.attributes['name'] == "Child") {
						let childId = getIdFromUrl(r.url);
						parentChildren.push(childId);
					}
				});
				let queryData = {
					ids: parentChildren,
					fields: ['System.State', 'System.Title', 'System.WorkItemType']
				}
				$.ajax({
					url: DEVOPS_URL,
					method: "POST",
					dataType: "json",
					crossDomain: true,
					contentType: "application/json; charset=utf-8",
					data: JSON.stringify(queryData),
					cache: false,
					success: function (data) {
						var itemsCount = data.count;
						var doneItemsCount = 0;
						var childrenType;
						var childrenNodes = [];
						$.each(data.value, (index, child) => {
							let childNode = {
								"id": child.id,
								"name": child.fields['System.Title'],
								"state": child.fields['System.State'],
								"url": DEVOPS_URL_EDIT+getIdFromUrl(child.url),
								"type": child.fields['System.WorkItemType']
							};
							childrenNodes.push(childNode);
							if (child.fields['System.State'] === "Done") {
								doneItemsCount++;
							}
						});
						let children = {
							"items": itemsCount,
							"doneItems": doneItemsCount,
							"nodes": childrenNodes
						}
						renderChildren(parentId, currentChildId, children);
					},
					error: function (jqXHR, textStatus, errorThrown) {
						console.log(errorThrown);
						sendLoadedMessage();
					}
				});
			}
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log(errorThrown);
			sendLoadedMessage();
		}
	});
}

let initChildrenListener = () => {
	$('div[data-hide-show]').click((event) => {
		console.log('test');
		let parentChildId = $(event.target).attr('data-hide-show');
		chrome.runtime.sendMessage({message: "loading"}, (response) => {});
		getChildrenForParents(parentChildId);
	});
}

let renderParents = (data) => {
	clearParents(data);
	$.each(data, (index, value) => {
		wiColor = getWIColor(value.parentType);
		wiIcon = getWIIcon(value.parentType);
		let idElem = $("div.id:contains("+value.childId+")");
		let titleElem = idElem.closest("div.id-title-container");
		let childrenDiv = "<div data-hide-show='"+value.parentId+"-"+value.childId+"' style='margin-top: 4px; cursor:pointer; display:block'><i class='fas fa-sitemap'></i> Toggle all items</div>";
		let parentElem = $("<div data-child='"+value.childId+"' data-parent='"+value.parentId+"'></div>")
			.html("<a target='_blank' style='color: "+wiColor+" !important' href='"+DEVOPS_URL_EDIT+value.parentId+"'><i class='fas fa-"+wiIcon+"'></i> <strong>"+value.parentId+"</strong> "+value.parentName+"</a>"+childrenDiv)
			.css({"display": "none", "margin": "8px", "padding": "5px", "border-bottom": "1px solid #605E5C", "border-top": "1px solid #605E5C", "border-right": "1px solid #605E5C", "border-left": "4px solid "+wiColor});
		titleElem.after(parentElem);
	});
	initChildrenListener();
	showParents(data);
}

let generateParentsDataForRendering = (data, wiWithParents) => {
	var parentsList = [];
	$.each(wiWithParents, (index, wip) => {
		$.each(data.value, (index, pwi) => {
			if(pwi.id === wip.parentId) {
				var node = {
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
		ids: desiredParents,
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
		success: function (data) {
			generateParentsDataForRendering(data, wiWithParents);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log(errorThrown);
			sendLoadedMessage();
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
		success: function (data) {
			fetchParentData(data);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log(errorThrown);
			sendLoadedMessage();
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
	chrome.runtime.sendMessage({message: "loading"}, (response) => {});
	fetchWIData(allIds);
}

chrome.runtime.onMessage.addListener((request, sender) => {
	if(request.message === "load_parents") {
		setupConfig(request.data);
	}
	return true;
});
