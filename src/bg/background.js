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
	if(request.message === "loading_parents")
		setLoadingState(true);
	else if(request.message === "parents_loaded") {
		setLoadingState(false);
		extensionLoaded = true;
	}
});

chrome.webRequest.onBeforeRequest.addListener((details) => {
	if(!extensionLoaded)
		return false;

	var postedString = decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes)));
	postedString = JSON.parse(postedString);

	if(details.url.indexOf("updateWorkItems") > 0) {
		postData = JSON.parse(postedString.updatePackage)[0];
		setTimeout(() => {
			sendMessage("load_parents", [postData.id.toString()]);
		}, 1000);
	} else if(details.url.indexOf("customerintelligence") > 0) {
		postData = postedString[0];
		if(postData.feature === "WorkItem.Closed") {
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