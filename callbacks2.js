//imports
var request = require('request'),
    mongoClient = require('mongodb').MongoClient;


function getAnyHomePage(){
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', findAnyUser);
}

function findAnyUser(err, db) {
    if(err) throw new Error("connection to db failed!");
    db.collection('users').findOne({}, fetchHomePage);
}

function fetchHomePage(err, one){
    if(err) throw new Error("no user found !");
    request(one.homepage, printPage);
}

function printPage(err, response, body){
    if(err || response.statusCode != 200) throw new Error("cannot get homepage");
    console.log(body);
}

getAnyHomePage();
