# Les promesses avec Q et nodejs

Lorsque l'on commence à monter une application web qui tourne sous node, avec quelques requêtes http sur un autre serveur et une persistance dans une base mongodb on est vite pris par l'enfer des callbacks (_callback hell_).

La solution la plus courante est d'utiliser les promesses. Simple... sur le papier en tout cas. Car dès que l'on dépasse le stade des 2-3 promesses à lancer l'une à la suite de l'autre on peut vite se retrouver à imbriquer des promesses les unes dans les autres, exactement comme on cherchait à ne pas faire avec les callbacks.

L'article commence par présenter l'implémentation des promesses dans des cas simples, puis propose des solutions à des cas plus élaborés pour permettre de garder un code plus lisible et donc plus maintenable.

J'ai choisi d'utiliser la librairie Q pour manipuler les promesses,  node-mongodb-native pour accéder à mongo, request pour faire des appels http, et express pour créer un serveur http. Les sources des exemples sont disponibles sur [github/jbcazaux/nodeQ](https://github.com/jbcazaux/nodeQ "github.com/jbcazaux/nodeQ").

L'article couvre les promesses d'un point de vue pratique, je ne reviens que très peu sur l'aspect théorique. L'objectif de l'article étant de présenter les bases de Q un peu plus en détail que ce qui est fait dans la documentation officielle, parfois avare en explications et exemples de code.

Les promesses permettent de construire un enchaînement d'actions, synchrones ou asynchrones. Cette chaîne d'actions peut être interrompue si une des actions échoue (créé une erreur) ou se réaliser entièrement quelque soient les retours de chaque action. Il est également possible d'attendre la fin de deux actions lancées en parallèle pour en exécuter une troisième qui prendra en paramètre d'entrée les résultats des deux précédentes.

## Installation

Installation de nodejs (préférer le ./configure --prefix='/opt/node' pour ne pas être obligé d'installer node et ses dépendances en root): [https://github.com/joyent/node/wiki/Installation](https://github.com/joyent/node/wiki/Installation "https://github.com/joyent/node/wiki/Installation")
Installation de mongo: [http://docs.mongodb.org/manual/installation/](http://docs.mongodb.org/manual/installation/ "http://docs.mongodb.org/manual/installation/")

Une fois nodejs et mongodb installés sur votre OS, il suffit de cloner nodeQ et faire un _npm install_ dans le répertoire du projet.
<pre lang="shell">
$>git clone git@github.com:jbcazaux/nodeQ.git
$>cd nodeQ
$>npm install
</pre>

Voici les dépendances du projet:
<pre lang="json">
{
    "name": "tutoQ",
    "description": "Exemples de code avec Q et node.",
    "version": "1.0.0",
    "dependencies": {
        "express": "3.4.0",
        "mongodb": "1.3.19",
        "request": "2.27.0",
	"q" : "0.9.7"
    },
    "engine": "node >= 0.10.20"
}
</pre>

Ensuite il faut initialiser la base de données tutoDB avec 2 entrées.

<pre lang="shell">
$>mongo tutoDB
>db.users.insert({login: 'user1', 'homepage': 'http://www.google.com'})
>db.users.insert({login: 'user2', 'homepage': 'http://www.yahoo.com'})
</pre>

##  Avec les callbacks

Dans le premier exemple on cherche à récupérer un utilisateur dans mongo puis afficher dans la console la homepage de cet utilisateur.

Ce script permet de mettre en évidence le callback hell.
<pre lang="javascript">
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
</pre>
_callbacks.js_

Dans le 2ème exemple on découpe en plusieurs fonctions ce qui aère tout de même le code. Le problème est dans le nommage des fonctions et dans le traitement des erreurs qui a un couplage très fort avec la méthode appelante.

<pre lang="javascript">
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
</pre>
_callbacks2.js_

##  Avec les promesses

Dire que les promesses servent à éviter le _callback hell_ serait extrêmement réducteur. En effet les promesses permettent surtout de profiter du paradigme de programmation asynchrone. Là où tout était fait séquentiellement avec les callbacks, grâce aux promesses il est possible de paralléliser les traitements et donc d'être plus rapide. Nous verrons ceci plus loin dans l'article.
Si la lisibilité du code vient ensuite dans la liste des atouts de cette technique, c'est tout de même une bonne introduction à la mise en place des promesses. Commençons donc par voir ce point.

Node ne permet pas de créer directement des promesses. Il faut donc utiliser des librairies comme Q pour en créer. C'est assez simple et cela respecte toujours la même syntaxe:
<pre lang="javascript">
function makePromise(){
 var deferred = Q.defer();
 actionAsynchrone(param, function(result){//callback 
  deferred.resolve(result);
 });
return deferred.promise;
}
</pre>

#### Implémentation naïve

Cette première implémentation utilise les promesses mais la lisibilité n'est pas encore au rendez-vous (beaucoup de lignes inutiles et encore des callbacks). 

<pre lang="javascript">
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

</pre>
_promises1.js_

#### Avec un peu plus de classe

<pre lang="javascript">
Q().then(connectToMongo)
    .then(findAnyUser)
    .then(fetchHomePage)
    .then(console.log)
    .catch(console.log);

function connectToMongo(){
    var deferred = Q.defer();
    mongoClient.connect('mongodb://127.0.0.1:27017/tutoDB', deferred.makeNodeResolver());
    return deferred.promise;
}

function findAnyUser(db){
    var deferred = Q.defer();
    db.collection('users').findOne({}, deferred.makeNodeResolver());
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
</pre>
_promises2.js_

Q() crée une promesse qui ne fait rien, mais qui permet de chaîner notre premiere promesse 'connectToMongo'. Le style d'écriture des chaînes de promesses est plus homogène.
Au lieu de créer une fonction anonyme pour les callbacks, on peut utiliser deferred.makeNodeResolver() qui fait la même chose: un reject si une erreur survient et resolve() avec en paramètre un tableau contenant les autres arguments du callback. 
Pour le callback de la requête http, on gère un cas spécifique et on est obligé d'écrire une fonction anonyme de callback. Il y a toujours les lignes de création du deferred et le return promise qui créent du bruit mais on ne pourra pas s'en débarrasser.

#### Passer un paramètre supplémentaire à une promesse

Par nature, les promesses ne prennent qu'un seul argument en entrée et ne retourne qu'au plus un objet.
On a souvent besoin de paramétrer nos promesses, par exemple en passant un critère de recherche ou un objet portant la connexion à la base de données. 
Dans le cas suivant on va chercher à retrouver un utilisateur par son login.

<pre lang="javascript">
Q().then(connectToMongo)
    .then(findUserByLogin('user1'))
    .then(fetchHomePage)
    .then(console.log)
    .catch(console.log);

[...]

function findUserByLogin(login){
    return function(db){
        var deferred = Q.defer();
        db.collection('users').findOne({'login': login}, deferred.makeNodeResolver());
        return deferred.promise;
    }
}

[...]
</pre>
_promisesWithParam.js_

Dans la configuration actuelle nous ne pouvions pas clore la connexion à mongo. Pour palier à çà 2 solutions, qui vont toutes les deux exposer la variable db.
Le mot clé finally permet d'exécuter une fonction à l'issue d'une promesse, qu'elle ait été satisfaite ou non.

<pre lang="javascript">
Q().then(connectToMongo)
    .then(function(db){
        Q(db).then(findUserByLogin('user1'))
            .then(fetchHomePage)
            .then(console.log)
            .catch(console.log)
            .finally(function(){
                db.close();
            })
    });

[...]
</pre>
_promisesWithVar1.js_

<pre lang="javascript">
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

[...]                        
</pre>
_promisesWithVar2.js_

Suivant les contextes d'utilisation on peut choisir une des deux méthodes, voire les deux combinées.

#### Parallélisation de requêtes

Un atout majeur dans les promesses est de pouvoir lancer plusieurs requêtes en même temps et de pouvoir être prévenu quand elles ont toutes fonctionné.
Dans l'exemple suivant on cherche a savoir quel utilisateur à la homepage la plus 'lourde'. Comme on ne connait pas a l'avance le nombre d'utilisateurs en base il faut créer dynamiquement les chaînes de promesses.

<pre lang="javascript">
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
    var deferred = Q.defer();

    var promises = [];
    allUsers.forEach(function(user){
        promises.push(fetchHomePage(user));
    });

    Q.allSettled(promises).then(function(results){
        var homepageWeigths = new Array();
        results.forEach(function(r){
            if (r.state != "fulfilled"){
                console.log('warning : problem getting an homepage');
            }else{
                homepageWeigths.push(r.value.length);
            }
        });
        deferred.resolve(homepageWeigths);
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

function electBiggest(weights){
    if (weights.length < 1) throw new Error('no page fetched !');
    return Math.max.apply(Math, weights);
}

</pre>
_promisesConcurrent.js_

Dans cet exemple j'ai choisi de ne pas stopper la chaîne des promesses si la récupération d'une homepage posait problème (pas de réseau ou 404). J'ai donc utilisé Q.allSettled. Si dès qu'une erreur surgit la chaîne doit être cassée, Q.all() fera l'affaire.

<pre lang="javascript">
[...]

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

[...]
</pre>
_promisesConcurrentWithFailure.js_

#### Parallélisation des chaînes de promesses

Lorsque l'on crée la liste de promesses dynamiquement rien ne nous empèche de faire une liste de chaînes de promesses. En effet une chaîne de promesse est elle-même une promesse.

Dans cet exemple on va chercher a récupérer le contenu de la homepage d'un utilisateur puis la sauver dans mongo.

<pre lang="javascript">
var _db;
Q().then(connectToMongo)
    .then(findAllUsers)
    .then(fetchAndSaveAllHomePages)
    .catch(function(err){
        console.log('in error : ', err);
    })
    .finally(function(){
        console.log('close db');
        _db.close();
    });

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

function fetchAndSaveAllHomePages(allUsers){
    var deferred = Q.defer();

    var promises = [];
    allUsers.forEach(function(user){
        promises.push(fetchHomePage(user).timeout(5000).then(updateUserWithHomePage(user)));
    });

    Q.allSettled(promises).then(function(results){
        var homepageWeigths = new Array();
        results.forEach(function(r){
            if (r.state != "fulfilled"){
                console.log('warning : problem fetching or saving an homepage : ', r.reason);
            }else{
                homepageWeigths.push(r.value.length);
            }
        });
        deferred.resolve(homepageWeigths);
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

function updateUserWithHomePage(user){
    return function(homepage){
        user.homepageContent = homepage;
        var deferred = Q.defer();
        _db.collection('users').update(
            {'login' : user.login},
            user,
            {upsert: true, safe: true},
            deferred.makeNodeResolver());
        return deferred.promise;
    }
}
</pre>
_promisesConcurrentWithChainOfPromises.js_

timeout() est une méthode proposée par Q pour rejeter une promesse si celle ci n'a pas été réalisée au bout d'un temps donné.  

### Finally

Voici un exemple complet avec un serveur web qui permet d'afficher la home page d'un utilisateur passé dans la requète. A des fins de lisibilité je mixe l'utilisation des callbacks et des promesses.

<pre lang="javascript">
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

app.get('/user', function(req, res){
    var login = req.param('login');
    Q().then(fetchHomePageOf(login))
        .then(function(html){
            res.status(200).send(html);
        })
        .catch(function(err){
            res.status(404).send("erreur dans la récupération de la page\n" + err);
        })
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
                        console.log('aie aie : ', err);
                        deferred.reject('error while getting user\n' + err);
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
</pre>
_app.js_

Développer avec les promesses nécessite une nouvelle approche dans la construction du code. Il est important de correctement les utiliser pour garder un code optimisé, qui fait une remontée propre des erreurs et qui reste lisible.

#### Liens externes

Les créateurs de la lib Q ont documenté leur librairie avec d'autres exemples et un [wiki](https://github.com/kriskowal/q/wiki "https://github.com/kriskowal/q/wiki"): [https://github.com/kriskowal/q](https://github.com/kriskowal/q "https://github.com/kriskowal/q")
Ce projet github est aussi une bonne source d'informations : [https://github.com/bellbind/using-promise-q/](https://github.com/bellbind/using-promise-q/ "https://github.com/bellbind/using-promise-q/")
callback hell : [http://callbackhell.com](http://callbackhell.com/ "http://callbackhell.com/")
