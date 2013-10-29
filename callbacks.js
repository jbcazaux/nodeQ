//imports
var request = require('request'),
    mongoClient = require('mongodb').MongoClient;


function getAnyHomePage(){
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', function(err, db) {
        if(err) throw new Error("connection to db failed!");
        db.collection('users').findOne({}, function(err, one){
            if(err) throw new Error("no user found !");
            request(one.homepage, function(err, response, body){
                if(err || response.statusCode != 200) throw new Error("cannot get homepage");
                console.log(body);
            });
        })
    });
}

getAnyHomePage();

