//imports
var request = require('request'),
    mongoClient = require('mongodb').MongoClient,
    Q = require('q');

connectToMongo()
    .then(findAnyUser)
    .then(fetchHomePage)
    .then(console.log)
    .catch(console.log);

function connectToMongo(){
    var deferred = Q.defer();
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', function(err, db) {
        if(err) deferred.reject(err);
        else {
            deferred.resolve(db);
        }
    });
    return deferred.promise;
}

function findAnyUser(db){
    var deferred = Q.defer();
    db.collection('users').findOne({}, function(err, one){
        if (err) deferred.reject(err);
        else deferred.resolve(one);
    });
    return deferred.promise;
}

function fetchHomePage(user){
    var deferred = Q.defer();
    request(user.homepage, function(err, response, body){
        if(err || response.statusCode != 200) deferred.reject(err || response.statusCode );
        else deferred.resolve(body);
    });
    return deferred.promise;
}
