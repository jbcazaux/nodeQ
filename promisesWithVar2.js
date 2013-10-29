//imports
var request = require('request'),
    mongoClient = require('mongodb').MongoClient,
    Q = require('q');


var _db;
Q().then(connectToMongo)
    .then(findUserByLogin('user1'))
    .then(fetchHomePage)
    .then(console.log)
    .catch(console.log)
    .finally(function(){
        _db.close();
    })

function connectToMongo(){
    var deferred = Q.defer();
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', function(err, db) {
        if(err) deferred.reject(err);
        else {
            _db = db;
            deferred.resolve(db);
        }
    });
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
