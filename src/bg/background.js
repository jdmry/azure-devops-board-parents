var extensionLoaded = false;

let setLoadingState = (state) => {
	let text = state ? "LOAD" : "";
	chrome.browserAction.setBadgeText({"text": text});
}

let sendMessage = (mess, da) => {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {message: mess, data: da}, function(response) {});
	});
}

chrome.browserAction.onClicked.addListener(() => {
	sendMessage("load_parents", []);
});

chrome.runtime.onMessage.addListener((request, sender) => {
	switch(request.message) {
		case "loading":
			setLoadingState(true);
			break;
		case "loaded":
			setLoadingState(false);
			extensionLoaded = true;
			break;
	}
	return true;
});

chrome.webRequest.onBeforeRequest.addListener((details) => {
	if(!extensionLoaded)
		return false;

	var postedString = decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes)));
	postedString = JSON.parse(postedString);

	if(details.url.indexOf("updateWorkItems") > 0) {
		updateWorkItemPost = JSON.parse(postedString.updatePackage)[0];
		setTimeout(() => {
			sendMessage("load_parents", [updateWorkItemPost.id.toString()]);
		}, 1500);
	} else if(details.url.indexOf("customerintelligence") > 0) {
		customIntelPost = postedString[0];
		if(customIntelPost.feature === "WorkItem.Closed") {
			sendMessage("load_parents", []);
		}
	}
}, {
	urls: [
		"https://dev.azure.com/*/_api/_wit/updateWorkItems*",
		"https://dev.azure.com/*/_apis/customerintelligence/Events"
	]
}, [
	"requestBody"
]);