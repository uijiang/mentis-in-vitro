var React = require('react');
var Tree = require('./lib/Tree');
window.$ = window.jQuery = require('jquery');
var bootstrap = require('bootstrap');
var Cursor = require('./lib/Cursor');
var _ = require('underscore');
var UndoRing = require('./lib/UndoRing');
var opml = require('opml-generator');
var ReactDOM = require('react-dom');
var MongoTree = require('./lib/MongoTree');

var DragDropContext = require('react-dnd').DragDropContext;
var HTML5Backend = require('react-dnd-html5-backend');
var DragSource = require('react-dnd').DragSource;
var PropTypes = React.PropTypes;

var ReactTree = {};
var globalTree;
var globalTreeBak;
var globalOldTree;
var globalParseTree;
var globalUndoRing;
var globalDataSaved = true;
var isListRefreshed = false;
var docSelected = "";
var globalSkipFocus = false; // TODO remove?
var globalCompletedHidden;
// import ReactSortableTree from 'react-sortable-tree';

var DataSaved = React.createClass({
    render: function() {
        console.log('DataSaved');
        var text = globalDataSaved ? "已保存" : "未保存";
        return (<span className='saved-text'>{text}</span>);
    }
});

var Breadcrumb = React.createClass({
    render: function() {
        var text = this.breadcrumbToText(Tree.getBreadcrumb(this.props.node));
        if (text.length > 0) {
            return (<div><span className='breadcrumb'>{text}</span><hr/></div>);
        } else {
            return <div></div>;
        }
    },
    breadcrumbToText: function(titles) {
        if (titles.length > 0) {
            return titles.join(' > ') + ' >';
        }
        return '';
    }
});

var CompleteHiddenButton = React.createClass({
    render: function() {
        console.log('go and render', globalCompletedHidden);
        var text = globalCompletedHidden ? 'Show completed' : 'Hide completed';
        return (<a href="#" className='completed-hidden-button' onClick={this.handleClick}>{text}</a>);
    },
    handleClick: function(e) {
        globalCompletedHidden = !globalCompletedHidden;
        Tree.setCompletedHidden(globalTree, globalCompletedHidden);
        renderAll();
        e.preventDefault();
    }
});

var LogoutButton = React.createClass({
    render: function() {
        console.log('LogoutButton');
        return (<a href="/logout">退出</a>);
    }
});

var NewButton = React.createClass({
    render: function() {
        console.log('NewButton');
        return (
            <a href="#" onClick={this.handleClick}>新建</a>
        );
    },
    handleClick: function(e) {
        console.log('new');
        isListRefreshed = true;
        ReactDOM.render(ReactTree.to_react_element(this.props.tree, true),
            document.getElementById("tree")
        );
        e.preventDefault();
    }
});

var NewDocPanel = React.createClass({
    getInitialState: function() {
        return {docName: ''};
    },
    render: function() {
        console.log('NewDoc');
        return (
            <div className="back-panel">
                <div className="front-panel">
                    <span className="panel-item">请输入文档名称</span>
                    <input className="panel-input" type="text"
                           onChange={this.handleNameChange}></input>
                    <div className="panel-buttons">
                        <button onClick={this.handleClick}>确定</button>
                        <button onClick={this.handleCancel}>取消</button>
                    </div>
                </div>
            </div>
        );
    },
    handleNameChange: function(e) {
        this.setState({docName: e.target.value});
    },
    handleCancel: function(e) {
        e.preventDefault();
        ReactDOM.render(ReactTree.to_react_element(this.props.tree, false),
            document.getElementById("tree")
        );

    },
    handleClick: function (e) {
        e.preventDefault();
        var docName = this.state.docName.trim();
        if (!docName) {
            return;
        }
        globalTree = Tree.makeDefaultTree(docName);
        isListRefreshed = true;
        
        // 触发首次保存
        globalParseTree.set('tree', Tree.toString(globalTree));
        globalParseTree.create(function () {
            globalDataSaved = true;
            docSelected = globalParseTree.getID('tree');

            renderAllNoUndo();
            globalUndoRing.commit();
        });
        this.setState({docName: ''});
    }
});

var DocList = React.createClass({
    getInitialState: function() {
        return {
            data: [],
            idToRemove : "",
            nameToRemove: "",
            idToRename : "",
            nameToRename:""
        };
    },
    loadListFromServer: function() {
        $.ajax({
            url: '/documentlist' ,
            dataType: 'json',
            contentType:'application/json; charset=utf-8',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    componentWillReceiveProps: function(props) {
        if (props.isListRefreshed === true) {
            this.loadListFromServer();
        }
    },
    componentDidMount: function() {
        this.loadListFromServer();
    },
    render: function() {
        isListRefreshed = false;
        var handleMenuClick = this.handleMenuClick;
        var handleItemRemove = this.handleItemRemove;
        var handleItemRename = this.handleItemRename;
        var handleItemShare = this.handleItemShare;

        var that = this;
        var menuItems = this.state.data.map(function(menuItem) {
            var className = "list-li-span";
            if (docSelected === menuItem._id) {
                className += " list-li-span-selected";
            }

            return (
                <li key={menuItem._id}>
                    <div className="doclist-title"><span onClick={handleMenuClick.bind(that, menuItem._id)}
                                                         className={className}>{menuItem.docName}</span></div>
                    <div className="doclist-actions" onClick={handleItemRename.bind(that, menuItem._id, menuItem.docName)}><span aria-hidden="true" className="icon_pencil-edit"></span>
                    </div>
                    <div className="doclist-actions" onClick={handleItemRemove.bind(that, menuItem._id, menuItem.docName)}><span aria-hidden="true" className="icon_trash_alt"></span>
                    </div>
                    <div className="doclist-actions" onClick={handleItemShare.bind(that, menuItem._id, menuItem.docName)}><span aria-hidden="true" className="social_share"></span>
                    </div>
                </li>
            );
        });

        var confirmPanel = "";
        if (this.state.idToRemove) {
            confirmPanel = (<div className="back-panel">
                <div className="front-panel">
                    <span className="panel-item">确认要删除文档 {this.state.nameToRemove}?</span>
                    <div className="panel-buttons">
                        <button onClick={this.handleRemoveClick}>确定</button>
                        <button onClick={this.handleRemoveCancel}>取消</button>
                    </div>
                </div>
            </div>);
        }
        var renamePanel = "";
        if (this.state.idToRename) {
            renamePanel = (<div className="back-panel">
                <div className="front-panel">
                    <span className="panel-item">请输入文档名称</span>
                    <input className="panel-input" type="text" value={this.state.nameToRename}
                           onChange={this.handleNameChange}></input>
                    <div className="panel-buttons">
                        <button onClick={this.handleRenameClick}>确定</button>
                        <button onClick={this.handleRenameCancel}>取消</button>
                    </div>
                </div>
            </div>);
        }
        var sharePanel = "";
        if (this.state.idToShare) {
            sharePanel = (<div className="back-panel">
                <div className="front-share-panel">
                    <span className="panel-item">分享:{this.state.nameToShare}</span>
                    <span className="panel-item">http://192.168.25.12:8888/index.html?docId={this.state.idToShare}</span>
                    <div className="panel-buttons">
                        <button onClick={this.handleShareCancel}>确定</button>
                        <button onClick={this.handleShareCancel}>取消</button>
                    </div>
                </div>
            </div>);
        }
        return <div>
            <ul>{menuItems}</ul>
            {confirmPanel}
            {renamePanel}
            {sharePanel}
        </div>;
    },
    handleMenuClick: function(docId) {
        this.props.docClick(docId);
    },
    handleItemRemove: function(docId, docName) {
        this.setState(
            {
                idToRemove: docId,
                nameToRemove: docName
            });
    },
    handleItemRename: function(docId, docName) {
        this.setState(
            {
                idToRename: docId,
                nameToRename: docName
            });
    },
    handleItemShare: function(docId, docName) {
        this.setState(
            {
                idToShare: docId,
                nameToShare: docName
            });
    },
    handleNameChange: function(e) {
        this.setState({nameToRename: e.target.value});
    },
    handleRemoveCancel: function(e) {
        e.preventDefault();
        this.setState(
            {
                idToRemove: "",
                nameToRemove: ""
            });

    },
    handleShareCancel: function(e) {
        e.preventDefault();
        this.setState(
            {
                idToShare: "",
                nameToShare: ""
            });

    },
    handleRenameCancel: function(e) {
        e.preventDefault();
        this.setState(
            {
                idToRename: "",
                nameToRename: ""
            });

    },
    handleRemoveClick: function (e) {
        e.preventDefault();
        var url = '/documents';
        var json = {};
        json.id = this.state.idToRemove;
        $.ajax({
            url: url,
            dataType: 'json',
            contentType:'application/json; charset=utf-8',
            type: 'DELETE',
            data: JSON.stringify(json),
            success: function(data) {
                isListRefreshed = true;
                if (this.state.idToRemove === docSelected) {
                    var url = '/documents/';
                    $.ajax({
                        url: url,
                        dataType: 'json',
                        type: 'GET',
                        success: function(data) {
                            var parseTree = new MongoTree(data);
                            globalTree = Tree.fromString(parseTree.get('tree'));
                            console.log(globalTree);
                            console.log('hidden is', Tree.isCompletedHidden(globalTree));
                            globalCompletedHidden = Tree.isCompletedHidden(globalTree);
                            globalParseTree = parseTree;
                            docSelected = globalParseTree.getID('tree');
                            var newTree = Tree.clone(globalTree);
                            globalUndoRing = new UndoRing(newTree, 50);
                            isListRefreshed = true;
                            ReactDOM.render(ReactTree.to_react_element(newTree, false),
                                document.getElementById("tree")
                            );
                        }.bind(this),
                        error: function(xhr, status, err) {
                            console.error(url, status, err.toString());
                        }.bind(this)
                    });
                } else {
                    ReactDOM.render(ReactTree.to_react_element(this.props.tree, false),
                        document.getElementById("tree")
                    );
                }
                this.setState({
                    idToRemove: "",
                    nameToRemove: ""
                });
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(url, status, err.toString());
            }.bind(this)
        });

    },
    handleRenameClick: function (e) {
        e.preventDefault();
        var url = '/documents/rename';
        var json = {};
        json.id = this.state.idToRename;
        json.newName = this.state.nameToRename;
        $.ajax({
            url: url,
            dataType: 'json',
            contentType:'application/json; charset=utf-8',
            type: 'PUT',
            data: JSON.stringify(json),
            success: function(data) {

                isListRefreshed = true;
                ReactDOM.render(ReactTree.to_react_element(this.props.tree, false),
                    document.getElementById("tree")
                );
                this.setState({
                    idToRename: "",
                    nameToRename: ""
                });
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(url, status, err.toString());
            }.bind(this)
        });

    }
});

var SearchBox = React.createClass({
    getInitialState: function() {
        return {value: ''};
    },
    handleChange: function(event) {
        this.setState({value: event.target.value});
        console.log('cool', event.target.value);
        if (event.target.value.length === 0) {
            globalTree = globalTreeBak;
            globalTreeBak = null;
            renderAllNoUndo();
            return;
        }
        if (!globalTreeBak) {
            globalTreeBak = globalTree;
            globalTree = Tree.search(globalTree, event.target.value);
        } else {
            globalTree = Tree.search(globalTreeBak, event.target.value);
        }
        renderAllNoUndo();
    },
    handleFocus: function() {
        globalTree.selected = null;
    },
    render: function() {
        console.log('SearchBox');
        return <input type="text" className='search' placeholder='Search' value={this.state.value} onChange={this.handleChange} onFocus={this.handleFocus} />;
    }
});

ReactTree.TreeChildren = React.createClass({
    getInitialState: function() {
        return {
            treeData: this.props.children,
        };
    },
    render: function() {
        var children;
        var level = this.props.level;
        if (this.props.children != null) {
            var that = this;
            children = this.props.children.map(function(value, index) {
                return <li key={index}><ReactTree.TreeNode node={value} /></li>
            });
        }

        return (
        //
        // <ReactSortableTree myName="World"
        //                    treeData={this.state.treeData}
        //                    updateTreeData={this.updateTreeData}/>

        <ul style={this.props.style}>
            {children}
        </ul>
        );

    },

    updateTreeData(treeData) {
        this.setState({ treeData : treeData});
    }
});

// Add React DnD to this component -- C.H

var _TreeNode = React.createClass({
    getInitialState: function() {
        return {
            mouseOver: false
        };
    },

    handleChange: function(event) {
        var html = this.refs.input.textContent;
        if (html !== this.lastHtml) {
            var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
            currentNode.title = event.target.textContent;
            globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
            renderChange();
        } else {
            console.assert(false, 'Why am I getting a change event if nothing changed?');
        }
        this.lastHtml = html;
    },

    handleClick: function(event) {
        if (globalSkipFocus) {
            return;
        }
        var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
        globalTree.selected = currentNode.uuid;
        if (event.type === 'focus') {
            globalTree.caretLoc = currentNode.title.length;
        } else {
            globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
        }
    },

    componentDidMount: function() {
        if (this.props.node.uuid === globalTree.selected) {
            var el = $(this.refs.input);
            globalSkipFocus = true;
            el.focus();
            globalSkipFocus = false;
            Cursor.setCursorLoc(el[0], globalTree.caretLoc);
        }
    },
    handleKeyDown: function(e) {
        var KEYS = {LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40,
            ENTER: 13,
            TAB: 9,
            BACKSPACE: 8,
            Z: 90,
            Y: 89,
            S: 83,
            C: 67,
            END: 35,
            HOME: 36,
            SPACE: 32};
        if (e.keyCode === KEYS.LEFT) {
            if (e.ctrlKey) {
                Tree.zoomOutOne(globalTree);
                renderAll();
                e.preventDefault();
            } else {
                var newCaretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
                if (newCaretLoc === 0) {
                    Tree.selectPreviousNode(globalTree);
                    var selected = Tree.findSelected(globalTree); // TODO could do this faster than two searches
                    globalTree.caretLoc = selected.title.length;
                    renderAll();
                    e.preventDefault();
                } else {
                    globalTree.caretLoc = newCaretLoc - 1;
                }
            }
        } else if (e.keyCode === KEYS.END && e.ctrlKey) {
            Tree.selectLastNode(globalTree);
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.HOME && e.ctrlKey) {
            Tree.selectFirstNode(globalTree);
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.UP) {
            if (e.shiftKey && e.ctrlKey) {
                Tree.shiftUp(globalTree);
            } else {
                Tree.selectPreviousNode(globalTree);
                globalTree.caretLoc = 0;
            }
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.RIGHT) {
            if (e.ctrlKey) {
                var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
                Tree.zoom(currentNode);
                renderAll();
                e.preventDefault();
            } else {
                var newCaretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
                if (newCaretLoc === this.refs.input.textContent.length) {
                    Tree.selectNextNode(globalTree);
                    globalTree.caretLoc = 0;
                    renderAll();
                    e.preventDefault();
                } else {
                    globalTree.caretLoc = newCaretLoc + 1;
                }
            }
        } else if (e.keyCode === KEYS.DOWN) {
            if (e.shiftKey && e.ctrlKey) {
                Tree.shiftDown(globalTree);
            } else {
                console.log('down');
                Tree.selectNextNode(globalTree);
                globalTree.caretLoc = 0;
            }
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.ENTER && e.ctrlKey) {
            console.log('complete current');
            Tree.completeCurrent(globalTree);
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.ENTER) {
            var caretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
            globalTree.caretLoc = caretLoc;
            console.log('loc', caretLoc);
            Tree.newLineAtCursor(globalTree);
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.BACKSPACE) {
            if (e.ctrlKey && e.shiftKey) {
                Tree.deleteSelected(globalTree);
                renderAll();
                e.preventDefault();
            } else {
                globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(this.refs.input);
                if (globalTree.caretLoc === 0) {
                    Tree.backspaceAtBeginning(globalTree);
                    renderAll();
                    e.preventDefault();
                }
            }
        } else if (e.keyCode === KEYS.TAB) {
            if (e.shiftKey) {
                Tree.unindent(globalTree);
            } else {
                Tree.indent(globalTree);
            }
            renderAll();
            e.preventDefault();

        } else if (e.keyCode === KEYS.SPACE && e.ctrlKey) {
            Tree.collapseCurrent(globalTree);
            renderAll();
            e.preventDefault();
        } else if (e.keyCode === KEYS.Z && (e.ctrlKey || e.metaKey)) {
            globalTree = Tree.clone(globalUndoRing.undo());
            renderAllNoUndo();
            e.preventDefault();
        } else if (e.keyCode === KEYS.Y && (e.ctrlKey || e.metaKey)) {
            globalTree = Tree.clone(globalUndoRing.redo());
            renderAllNoUndo();
            e.preventDefault();
        } else if (e.keyCode === KEYS.S && e.ctrlKey) {
            console.log('ctrl s');
            console.log(JSON.stringify(Tree.cloneNoParentClean(globalTree), null, 4));
            window.prompt("Copy to clipboard: Ctrl+C, Enter", JSON.stringify(Tree.cloneNoParentClean(globalTree), null, 4));
            e.preventDefault();
        } else if (e.keyCode === KEYS.C && e.ctrlKey) {
            var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
            var outlines = Tree.toOutline(currentNode);
            console.log(opml({}, [outlines]));
            e.preventDefault();
        } else {
            console.log(e.keyCode);
        }
    },

    componentDidUpdate: function(prevProps, prevState) {
        console.log('updated', this.props.node.title);
        if (this.props.node.uuid === globalTree.selected) {
            var el = $(this.refs.input);
            globalSkipFocus = true;
            //console.log('focus on', this.props.node.title);
            el.focus();
            globalSkipFocus = false;
            Cursor.setCursorLoc(el[0], globalTree.caretLoc);
        }
        // if ( this.refs.input && this.props.node.title !== this.refs.input.getDOMNode().textContent ) {
        //     // Need this because of: http://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
        //     // An example he was mentioning is that the virtual dom thinks that the div is empty, but if
        //     // you type something and then press "clear", or specifically set the text, the VDOM will
        //     // think the two are the same.
        //     // I believe this will never happen for me though? Because I don't overtly set text.. text is only set when someone is typing, right?
        //     //this.refs.input.getDOMNode().textContent = this.props.node.title;
        //     console.assert(false, 'Did not expect this to get hit. My thoughts are wrong. Check out the comments.');
        // }
    },

// TODO good for speedups..
//shouldComponentUpdate: function(nextProps, nextState) {
    //return !_.isEqual(this.props, nextProps);
//},
// TODO something about cursor jumps need this?
// See: http://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
// I think what "cursor jump" means is that if we set the textContent for some reason, but we are
// actually just setting it to be the exact same html, then the cursor will jump to the front/end.
//shouldComponentUpdate: function(nextProps){
    //return nextProps.html !== this.getDOMNode().textContent;
    //},

    render: function() {
        var className = "dot";
        if (this.props.node.children != null) {
            className = "dot togglable";
            if (this.props.node.collapsed) {
                className += " dot-collapsed";
            }
        }

        var contentClassName = "editable";
        if (this.props.topBullet) {
            contentClassName = "editable topBullet";
        }
        if (this.props.node.title == 'special_root_title') {
            contentClassName += ' display-none';
        }

        if (this.props.node.completed) {
            contentClassName += " completed";
        }

        var plus;
        if (this.state.mouseOver) {
            if (this.props.node.children != null && this.props.node.collapsed) {
                plus = (<div onClick={this.toggle} className='collapseButton'>+</div>);
            } else {
                plus = (<div onClick={this.toggle} className='collapseButton'>-</div>);
            }
        }
        var bulletPoint = '';
        if (!this.props.topBullet) {
            bulletPoint = (<span /*TODOonClick={this.zoom}*/ onMouseOver={this.mouseOver} className={className}>{String.fromCharCode(8226)}</span>);
        }

        var children = '';
        if (this.props.topBullet || !this.props.node.collapsed) {
            children =
                <ReactTree.TreeChildren children={this.props.node.children} />
        }

        if (this.props.node.completed && globalCompletedHidden && !this.props.topBullet) {
            return false;
        }

        var textBox = (
            <div className={contentClassName} contentEditable
                 ref="input"
                 onKeyDown={this.handleKeyDown}
                 onInput={this.handleChange}
                 onFocus={this.handleClick}
                 onClick={this.handleClick}
                 dangerouslySetInnerHTML={{__html: _.escape(this.props.node.title)}}>
            </div>);
        if (globalTreeBak) {
            textBox = (
                <div className={contentClassName}
                     ref="input"
                     onKeyDown={this.handleKeyDown}
                     onInput={this.handleChange}
                     onFocus={this.handleClick}
                     onClick={this.handleClick}
                     dangerouslySetInnerHTML={{__html: _.escape(this.props.node.title)}}>
                </div>);
        }

        var isDragging = this.props.isDragging;
        var connectDragSource = this.props.connectDragSource;

        return connectDragSource(
            <div className='node-wrapper' onMouseLeave={this.mouseOut} style={{ opacity: isDragging ? 0.5 : 1 }}>
                <div className="node-direct-wrapper">
                    {bulletPoint}<div className='plus-wrapper'>{plus}</div>
                    {textBox}
                </div>
                {children}
            </div>
        );
    },

    toggle: function() {
        var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
        globalTree.selected = currentNode.uuid;
        Tree.collapseCurrent(globalTree);
        renderAll();
    },
    mouseOver: function() {
        this.setState({mouseOver: true});
    },
    mouseOut: function() {
        this.setState({mouseOver: false});
    },
    zoom: function() {
        var node = Tree.findFromUUID(globalTree, this.props.node.uuid);
        Tree.zoom(node);
        globalTree.selected = node.uuid;
        renderAll();
    }
});

/**
 * Implements the drag source contract.
 */
var cardSource = {
    beginDrag: function (props) {
        return {
            text: props.text
        };
    }
}

/**
 * Specifies the props to inject into your component.
 */
function collect(connect, monitor) {
    return {
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
    };
}

ReactTree.TreeNode = DragSource('card', cardSource, collect)(_TreeNode);

ReactTree.startRender = function(parseTree) {
    globalTree = Tree.fromString(parseTree.get('tree'));
    console.log(globalTree);
    console.log('hidden is', Tree.isCompletedHidden(globalTree));
    globalCompletedHidden = Tree.isCompletedHidden(globalTree);
    globalParseTree = parseTree;
    docSelected = globalParseTree.getID('tree');
    var newTree = Tree.clone(globalTree);
    globalUndoRing = new UndoRing(newTree, 50);
    renderAll();

    setInterval(function () {
        if (!globalDataSaved) {
            globalParseTree.set('tree', Tree.toString(globalTree));
            globalParseTree.save();
            globalDataSaved = true;
        }
        globalUndoRing.commit();
    }, 2000);
}


function renderAll() {
    // TODO speedup by removing clone. I might not need to clone. What this does is allow us to
    // use shouldComponentUpdate. If we have two versions of the tree, then we can compare if one
    // changed relative to the other, and we don't have to call render. But, we have to clone, which
    // may be slow.
    var newTree = Tree.clone(globalTree);
    if (!_.isEqual(globalOldTree, Tree.cloneNoParentNoCursor(globalTree))) {
        globalDataSaved = false;
        globalUndoRing.addPending(newTree);
        globalOldTree = Tree.cloneNoParentNoCursor(globalTree);
    }
    doRender(newTree);
};


function renderChange() {
    console.log('renderChange');
    var newTree = Tree.clone(globalTree);
    if (!_.isEqual(globalOldTree, Tree.cloneNoParentNoCursor(globalTree))) {
        globalDataSaved = false;
        globalUndoRing.addPending(newTree);
        globalOldTree = Tree.cloneNoParentNoCursor(globalTree);
    }
};

function renderAllNoUndo() {
    var newTree = Tree.clone(globalTree);
    doRender(newTree);
}

function docClick(docId) {
    var url = '/documents/' + docId;
    $.ajax({
        url: url,
        dataType: 'json',
        type: 'GET',
        success: function(data) {
            var MongoTree = require('./lib/MongoTree');
            docSelected = data._id;
            ReactTree.startRender(new MongoTree(data));

            //rawStartTree = data;
            //return rawStartTree;

        }.bind(this),
        error: function(xhr, status, err) {
            console.error(url, status, err.toString());
        }.bind(this)
    });
}

var _TreeWrapper = React.createClass({
    render: function() {
        return (
            <div className='pad-wrapper'>
                <div className='breadcrumbs-wrapper'><Breadcrumb node={this.props.tree}/></div>
                <ReactTree.TreeNode topBullet={true} node={this.props.tree.zoom}/>
            </div>
        )

    }
})

var TreeWrapper = DragDropContext(HTML5Backend)(_TreeWrapper);

ReactTree.to_react_element = function(tree, newDoc) {
    console.log('to_react_element');

    return (
        <div>
            <div className='header'><span className='logo'>WorkSlowy</span><SearchBox/>
                <div className='header-buttons'><NewButton tree={tree} /><DataSaved /><CompleteHiddenButton /><LogoutButton/></div>
            </div>
            {newDoc ? <NewDocPanel docClick={docClick} tree={tree} /> : null}

            <div className='list-wrapper'>
                <DocList docClick={docClick} tree={tree} isListRefreshed={isListRefreshed} />
            </div>

            <TreeWrapper tree={tree} />
        </div>
    );
};

function doRender(tree) {
    console.log('rendering with', Tree.toString(tree));

    // TODO should always have a zoom?
    //<ReactTree.TreeChildren children={tree.zoom.children} />
    if (tree.zoom !== undefined) {
        ReactDOM.render(ReactTree.to_react_element(tree, false),
            document.getElementById("tree")
        );
    } else {
        // TODO remove
        console.assert(false, 'I didn\'t think this would happen');
        //console.log('no zoom');
        //React.render(
        //<div>
        //<ResetButton/> | <a href="import.html">Import</a> | <DataSaved />
        //<div><Breadcrumb node={tree} /></div>
        //<ReactTree.TreeNode node={tree}/>
        //</div>,
        //document.getElementById("tree")
        //);
    }
}

module.exports = ReactTree;

