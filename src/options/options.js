let saveOptions = () => {
    let username = $("#username").val();
    let token = $("#token").val();

    chrome.storage.sync.set({
        username: username,
        token: token
    }, () => {
        let status = $("#status");
        status.text("Options Saved");
        setTimeout(function() {
            status.text("");
        }, 750);
    });
}

let restoreOptions = () => {
    chrome.storage.sync.get({
        username: "",
        token: ""
    }, (items) => {
        $("#username").val(items.username);
        $("#token").val(items.token);
    });
}

$(document).ready(restoreOptions);
$("#save").click(saveOptions);