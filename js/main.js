var _ = require('underscore');
var $ = require('jquery');
var ReactTree = require('./ReactTree');
var MongoTree = require('./lib/MongoTree');

var location = document.location.href;
var parArr = location.split("?")[1];
var url = '/documents/';

if (parArr && parArr.split("&") && parArr.split("&").length > 0) {
    parArr = parArr.split("&");
    for(var i = 0; i < parArr.length; i++){
        var parr = parArr[i].split("=");
        if(parr[0] == 'docId'){
            docId = parr[1];
            url += docId;
            break;
        }
    }
}

$.ajax({
    url: url,
    dataType: 'json',
    type: 'GET',
    success: function(data) {
        ReactTree.startRender(new MongoTree(data));

        //rawStartTree = data;
        //return rawStartTree;

    }.bind(this),
    error: function(xhr, status, err) {
        window.location = 'login.html';
    }.bind(this)
});
//ReactTree.startRender(new MongoTree(Tree.toString(Tree.makeDefaultTree())));