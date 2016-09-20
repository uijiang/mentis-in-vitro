/**
 * Created by ui on 16/3/16.
 */
var express = require('express');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb-core').BSON.ObjectID;
var assert = require('assert');
var md5 = require('md5');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;

var url = 'mongodb://etl:Tt123456@192.168.25.12:63007/workslowy';

var app = express();

app.use(express.static('../public'));
app.use(express.static('../js'));
app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

app.use(bodyParser.json());
app.use(require('body-parser').urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login' }), function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.json({isSuccess: true});
});

passport.use(new LocalStrategy(
    function(username, password, done) {
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            console.log("Connected correctly to server.");
            authUser(db, username, password, function(username2) {
                db.close();
                if (username2 != null && username === username2) {
                    return done(null, username2);
                } else {
                    return done(null, false, { message: 'Incorrect password.' });
                }
            });
        });
    }
));

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
    cb(null, user);
});

passport.deserializeUser(function(id, cb) {
        cb(null, id);
});

app.get('/documents/:id',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        findDocument(db, req.params.id, function(doc) {
            db.close();
            if (doc != null) {
                res.json(doc);
            }
        });
    });
});

//获得用户的默认文档
app.get('/documents/',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            console.log("Connected correctly to server.");
            findDefaultDocument(db, req.user, function(doc) {
                db.close();
                if (doc != null) {
                    res.json(doc);
                }
            });
        });
    });

app.get('/', function (req, res) {
    res.redirect('/main');
});

app.get('/login', function (req, res) {
    res.redirect('login.html');
});

app.get('/main',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    res.redirect('index.html');
});


app.get('/documentlist',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        listDocument(db, req.user, function(doc) {
            db.close();
            res.json(doc);
        });
    });
});

app.put('/documents/rename/',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        renameDocument(db, req.body, function() {
            db.close();
            res.json({result: 'success'});
        });
    });
});

app.post('/documents',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        insertDocument(db, req.body, req.user, function(result) {
            db.close();
            var json = {};
            json._id = result;
            res.json(json);
        });
    });
});

app.put('/documents',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        updateDocument(db, req.body,req.user, function() {
            db.close();
            res.json({ result: 'success'});
        });
    });
});

app.delete('/documents',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    MongoClient.connect(url, function(err, db) {
        assert.equal(null, err);
        console.log("Connected correctly to server.");
        deleteDocument(db, req.body,function() {
            db.close();
            res.json({ result: 'success'});
        });
    });
});

app.get('/logout',
    function(req, res){
        req.logout();
        res.redirect('/');
    });

app.listen(8888);

var findDocument = function(db, id, callback) {
    db.collection('documents').find({_id: ObjectID(id)}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (docs != null) {
            callback(docs[0]);
            return;
        } else {
            callback();
        }
    });
};

var findDefaultDocument = function(db, userName, callback) {
    db.collection('documents').find({username: userName}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (docs != null) {
            callback(docs[0]);
            return;
        } else {
            callback();
        }
    });
};

var authUser = function (db, userName, password, callback) {
    db.collection('users').find({username: userName}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (docs != null) {
            if (md5(password) === docs[0].password) {
                callback(docs[0].username);
            }
            return;
        } else {
            callback(null);
        }
    });
}

var insertDocument = function(db, obj, username, callback) {
    obj.username = username;
    db.collection('documents').insertOne( obj, function(err, result) {
        assert.equal(err, null);
        console.log("Inserted a document into the restaurants collection.");
        callback(result.insertedId);
    });
};

// 更新文档
var updateDocument = function(db, obj, username, callback) {
    db.collection('documents').find({_id: ObjectID(obj.id)}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (docs != null) {
            // 判断当前用户
            var canUpdate = false;
            if (docs[0].username === username || docs[0].sharePermission === "write") {
                obj.username = docs[0].username;
                db.collection('documents').replaceOne(
                    {_id: ObjectID(obj.id)},
                    obj,
                    function (err, result) {
                        assert.equal(err, null);
                        console.log("Update a document into the restaurants collection.");
                        callback();
                    });
            }
        }
    });
};

var renameDocument = function(db, obj, callback) {
    db.collection('documents').find({_id: ObjectID(obj.id)}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (docs != null) {
            docs[0].docName = obj.newName;
            db.collection('documents').replaceOne(
                {   _id : ObjectID(obj.id) },
                docs[0],
                function(err, result) {
                    assert.equal(err, null);
                    console.log("Update a document into the restaurants collection.");
                    callback();
                });
            return;
        } else {
            callback();
        }
    });

};

var deleteDocument = function(db, id, callback) {
    db.collection('documents').deleteOne(
        {_id : ObjectID(id.id)},
        function(err, result) {
            assert.equal(err, null);
            console.log("Inserted a document into the restaurants collection.");
            callback();
        }
    );
};

//获得当前用户的所有文档
var listDocument = function(db, username, callback) {
    db.collection('documents').find({username: username}).toArray(function(err, docs) {

        assert.equal(err, null);
        if (docs != null) {
            callback(docs);
        }

    });
};