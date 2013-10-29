//imports
var request = require('request'),
    mongoClient = require('mongodb').MongoClient,
    Q = require('q');

var _db;
Q().then(connectToMongo)
    .then(findAllUsers)
    .then(fetchAllHomePages)
    .then(electBiggest)
    .then(console.log)
    .catch(function(err){
        console.log('in error : ', err);
    })
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

function findAllUsers(){
    var deferred = Q.defer();
    _db.collection('users').find().toArray(deferred.makeNodeResolver());
    return deferred.promise;
}

function fetchAllHomePages(allUsers){

    var promises = [];
    allUsers.forEach(function(user){
        promises.push(fetchHomePage(user));
    });

    return Q.all(promises).spread(function(){
        var homepageWeigths = new Array();
        for (var i = 0 ; i < arguments.length; i++){
            homepageWeigths.push(arguments[i].length);
        }
        return homepageWeigths;
    });
}

function fetchHomePage(user){
    var deferred = Q.defer();

    request(user.homepage, function(err, response, body){
        if(err || response.statusCode != 200) deferred.reject(err || response.statusCode );
        else deferred.resolve(body);
    });
    return deferred.promise;
}

function electBiggest(weights){
    if (weights.length < 1) throw new Error('no page fetched !');
    return Math.max.apply(Math, weights);
}
