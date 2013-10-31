//imports
var express = require('express'),
    request = require('request'),
    mongoClient = require('mongodb').MongoClient,
    Q = require('q');

//running port
var port = 8123;

//server
var app = express();
app.configure(function() {
    app.use(app.router);
}).listen(port);
console.log("listening on " + port);

app.get('/user', function(req, response){
    var login = req.param('login');
    var sendError = sendErrorTo(response);
    var sendIt = sendResponseTo(response);
	
    Q().then(fetchHomePageOf(login))
        .then(sendIt)
        .catch(sendError)
        .finally(function(){
            console.log('response sent for login: ', login);
        });
});

function fetchHomePageOf(login){

    return function(){
        var deferred = Q.defer();

        Q().then(connectToMongo)
            .then(function(db){
                Q(db).then(findUserByLogin(login))
                    .then(fetchHomePage)
                    .then(function(homepage){
                        deferred.resolve(homepage);
                    })
                    .catch(function(err){
                        deferred.reject('error while getting user homepage: ' + err);
                    })
                    .finally(function(){
                        db.close();
                    });
            });

        return deferred.promise;
    }
}

function connectToMongo(){
    var deferred = Q.defer();
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', deferred.makeNodeResolver());
    return deferred.promise;
}

function findUserByLogin(login){
    return function(db){
        var deferred = Q.defer();
        db.collection('users').findOne({'login': login}, deferred.makeNodeResolver());
        return deferred.promise;
    }
}

function fetchHomePage(user){
    var deferred = Q.defer();
    request(user.homepage, function(err, response, body){
        if(err || response.statusCode != 200) deferred.reject(err || response.statusCode );
        else deferred.resolve(body);
    });
    return deferred.promise;
}

function sendErrorTo(response){
    return function(err){
	var html = '<html><body>erreur dans la récupération de la page:<br>$err</body></html>'
    	response.status(404).send(html.replace('$err', err));
    }
}

function sendResponseTo(response){
    return function(page){
	response.status(200).send(page);
    }
}
