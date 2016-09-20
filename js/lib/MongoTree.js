var $ = require('jquery');
var Tree = require('./Tree');

var MongoTree = function(tree) {
    this.tree = tree;
    this.treeStringForSave = JSON.stringify(this.tree);
    this.id = tree._id;
};

MongoTree.prototype.get = function(prop) {
    console.assert(prop === 'tree');
    return this.treeStringForSave;
};
MongoTree.prototype.getID = function(prop) {
    console.assert(prop === 'tree');
    return this.id;
};
MongoTree.prototype.set = function(prop, treeString) {
    console.assert(prop === 'tree');
    this.treeStringForSave = treeString;
};
MongoTree.prototype.create = function(callback) {
    var url = '/documents';
    if (this.treeStringForSave != null) {
        var treeJSON = JSON.parse(this.treeStringForSave);
        $.ajax({
            url: url,
            dataType: 'json',
            contentType:'application/json; charset=utf-8',
            type: 'POST',
            data: JSON.stringify(treeJSON),
            success: function(data) {
                this.id = data._id;
                callback();
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(url, status, err.toString());
            }.bind(this)
        });
    }
};

// 保存现有文档
MongoTree.prototype.save = function() {
    var url = '/documents';
    if (this.treeStringForSave != null) {
        var treeJSON = JSON.parse(this.treeStringForSave);
        treeJSON.id = this.id;
        $.ajax({
            url: url,
            dataType: 'json',
            contentType:'application/json; charset=utf-8',
            type: 'PUT',
            data: JSON.stringify(treeJSON),
            success: function(data) {
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(url, status, err.toString());
            }.bind(this)
        });
    }
};

MongoTree.prototype.getDefaultTree = function() {
    var rawStartTree = '';
    var url = '/documents/56eaa1e2c87f709a0720e284';
    $.ajax({
        url: url,
        dataType: 'json',
        type: 'GET',
        data: this.treeStringForSave,
        success: function(data) {
            rawStartTree = data;
            return rawStartTree;

        }.bind(this),
        error: function(xhr, status, err) {
            console.error(url, status, err.toString());
        }.bind(this)
    });
}
module.exports = exports = MongoTree;
