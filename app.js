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
    app.use(express.logger());
    app.use(app.router);
}).listen(port);
console.log("listening on " + port);

app.get('/user', function(req, response){
    var login = req.param('login');
    Q().then(fetchHomePageOf(login))
        .then(function(html){
            response.status(200).send(html);
        })
        .catch(sendError(response))
        .finally(function(){
            console.log('finally');
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

function sendError(response){
    return function(err){
	var html = '<html><body>erreur dans la récupération de la page:<br>$err</body></html>'
    	response.status(404).send(html.replace('$err', err));
    }
}
