# Les promesses avec Q et nodejs

Lorsque l'on commence à monter une application web qui tourne sous node, avec quelques requêtes http sur un autre serveur et une persistance dans une base mongodb on est vite pris par l'enfer des callbacks (en anglais [callback hell](http://callbackhell.com/) et qu’on trouve également sous le nom de [Pyramid of Doom](http://raynos.github.io/presentation/shower/controlflow.htm?full#PyramidOfDoom)).

La solution la plus courante est d'utiliser les [promesses](https://fr.wikipedia.org/wiki/Futures_%28informatique%29). Simple... sur le papier en tout cas. Car dès que l'on dépasse le stade des 2-3 promesses à lancer l'une à la suite de l'autre on peut vite se retrouver à imbriquer des promesses les unes dans les autres, exactement comme on cherchait à ne pas faire avec les callbacks.

Les promesses permettent de construire un enchaînement d'actions, synchrones ou asynchrones. Cette chaîne d'actions peut être interrompue si une des actions échoue (créé une erreur) ou se réaliser entièrement quelque soient les retours de chaque action. Il est également possible d'attendre la fin de deux actions lancées en parallèle pour en exécuter une troisième qui prendra en paramètre d'entrée les résultats des deux précédentes.

L'article commence par présenter l'implémentation des promesses dans des cas simples, puis propose des solutions à des cas plus élaborés pour permettre de garder un code plus lisible et donc plus maintenable.

J'ai choisi d'utiliser la librairie [Q](https://github.com/kriskowal/q) pour manipuler les promesses,  [node-mongodb-native](https://github.com/mongodb/node-mongodb-native) pour accéder à mongo, [request](https://github.com/mikeal/request) pour faire des appels http et enfin [express](https://github.com/visionmedia/express) pour créer un serveur http. Les sources des exemples sont disponibles sur [github.com/jbcazaux/nodeQ](https://github.com/jbcazaux/nodeQ).

L'article couvre les promesses d'un point de vue pratique, je ne reviens que très peu sur l'aspect théorique. L'objectif de l'article étant de présenter les bases de Q avec plus d’explications que dans la documentation officielle, parfois avare en cela et en exemples.

## Installation

Vous trouverez les informations nécessaires à l’installation de [nodejs](http://nodejs.org/) ici : [github.com/joyent/node/wiki/Installation](https://github.com/joyent/node/wiki/Installation) (préférer le ./configure --prefix='/opt/node' pour ne pas être obligé d'installer node et ses dépendances en root) et, pour [mongo](http://www.mongodb.org/) : [docs.mongodb.org/manual/installation/](http://docs.mongodb.org/manual/installation/)

Une fois nodejs et mongodb installés, il suffit de cloner ce projet [nodeQ](https://github.com/jbcazaux/nodeQ) et faire un _npm install_ dans le répertoire du projet.
npm, pour Node Package Manager, est le gestionnaire de dépendances pour nodejs (vous pourrez trouver plus d’informations dans cette [présentation](http://nodejsparis.bitbucket.org/20131009/intro_npm/)).
<pre lang="shell">
$>git clone git@github.com:jbcazaux/nodeQ.git
$>cd nodeQ
$>npm install
</pre>

Voici les dépendances du projet, listées dans le fichier [package.json](https://github.com/jbcazaux/nodeQ/blob/master/package.json) :
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

Ensuite, il faut initialiser la base de données tutoDB avec 2 entrées.

<pre lang="shell">
$>mongo tutoDB
>db.users.insert({login: 'user1', 'homepage': 'http://www.google.com'})
>db.users.insert({login: 'user2', 'homepage': 'http://www.yahoo.com'})
</pre>

##  Approche naturelle avec des callbacks

Dans le premier exemple on cherche à récupérer un utilisateur dans mongo puis afficher dans la console la page d’accueil de cet utilisateur.

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
Fichier source : [callbacks.js](https://github.com/jbcazaux/nodeQ/blob/master/callbacks.js)

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
Fichier source : [callbacks2.js](https://github.com/jbcazaux/nodeQ/blob/master/callbacks2.js)

##  Avec les promesses

Dire que les promesses servent à éviter le _callback hell_ serait extrêmement réducteur. En effet les promesses permettent surtout de profiter du paradigme de programmation asynchrone avec plus de facilité d’écriture. Là où tout était fait séquentiellement avec les callbacks, grâce aux promesses il est possible de paralléliser les traitements qui peuvent l’être et donc d'être plus optimisé. Nous verrons ceci plus loin dans l'article.
Si la lisibilité du code vient ensuite dans la liste des atouts de cette technique, c'est tout de même une bonne introduction à la mise en place des promesses. Commençons donc par voir ce point.

nodejs ne permet pas de créer directement des promesses. Il faut donc utiliser des librairies comme Q pour en créer. C'est assez simple et cela respecte toujours la même syntaxe :
<pre lang="javascript">
function makePromise(){
   var deferred = Q.defer();
   actionAsynchrone(param, function(result){ // callback 
      deferred.resolve(result);
   });
   return deferred.promise;
}
</pre>

#### Implémentation naïve avec Q

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
Fichier source : [promises1.js](https://github.com/jbcazaux/nodeQ/blob/master/promises1.js)

#### En exploitant un peu mieux les méthodes de Q

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
Fichier source : [promises2.js](https://github.com/jbcazaux/nodeQ/blob/master/promises2.js)

Q() crée une promesse qui ne fait rien, mais qui permet de chaîner notre premiere promesse 'connectToMongo'. Le style d'écriture des chaînes de promesses est plus homogène.
Au lieu de créer une fonction anonyme pour les callbacks, on peut utiliser deferred.makeNodeResolver() qui fait la même chose : un reject si une erreur survient et resolve() avec en paramètre un tableau contenant les autres arguments du callback. 
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
Fichier source : [promisesWithParam.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesWithParam.js)

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
Fichier source : [promisesWithVar1.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesWithVar1.js)

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
Fichier source : [promisesWithVar2.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesWithVar2.js)

Suivant les contextes d'utilisation on peut choisir une des deux méthodes, voire les deux combinées.

#### Parallélisation de requêtes

Un atout majeur dans les promesses est de pouvoir lancer plusieurs requêtes en même temps et de pouvoir être prévenu quand elles ont toutes fonctionné.
Dans l'exemple suivant on cherche a savoir quel utilisateur à la page d’accueil la plus 'lourde'. Comme on ne connait pas a l'avance le nombre d'utilisateurs en base il faut créer dynamiquement les chaînes de promesses.

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
    if (weights.length &lt; 1) throw new Error('no page fetched !');
    return Math.max.apply(Math, weights);
}
</pre>
Fichier source : [promisesConcurrent.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesConcurrent.js)

Dans cet exemple j'ai choisi de ne pas stopper la chaîne des promesses si la récupération d'une page d’accueil posait problème (en cas de problème réseau ou de réponse 404 du serveur). J'ai donc utilisé Q.allSettled. Si dès qu'une erreur surgit la chaîne doit être cassée, Q.all() fera l'affaire.

<pre lang="javascript">
[...]

function fetchAllHomePages(allUsers){

    var promises = [];
    allUsers.forEach(function(user){
        promises.push(fetchHomePage(user));
    });

    return Q.all(promises).spread(function(){
        var homepageWeigths = new Array();
        for (var i = 0 ; i &lt; arguments.length; i++){
            homepageWeigths.push(arguments[i].length);
        }
        return homepageWeigths;
    });
}

[...]
</pre>
Fichier source : [promisesConcurrentWithFailure.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesConcurrentWithFailure.js)

#### Parallélisation des chaînes de promesses

Lorsque l'on crée la liste de promesses dynamiquement rien ne nous empèche de faire une liste de chaînes de promesses. En effet une chaîne de promesse est elle-même une promesse.

Dans cet exemple on va chercher a récupérer le contenu de la page d’accueil d'un utilisateur puis la sauver dans mongo.

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
Fichier source : [promisesConcurrentWithChainOfPromises.js](https://github.com/jbcazaux/nodeQ/blob/master/promisesConcurrentWithChainOfPromises.js)

timeout() est une méthode proposée par Q pour rejeter une promesse si celle ci n'a pas été réalisée au bout d'un temps donné.  

### Finally

Voici un exemple complet avec un serveur web qui permet d'afficher la page d’accueil d'un utilisateur passé dans la requète. A des fins de lisibilité, je mixe l'utilisation des callbacks et des promesses.

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
</pre>
Fichier source : [app.js](https://github.com/jbcazaux/nodeQ/blob/master/app.js)

Pour tester : [http://localhost:8123/user?login=user1](http://localhost:8123/user?login=user1), [http://localhost:8123/user?login=user2](http://localhost:8123/user?login=user2).

Développer avec les promesses nécessite une nouvelle approche dans la construction du code. Il est important de les utiliser correctement pour garder un code optimisé, permettant une remontée propre des erreurs tout en restant lisible.

#### Liens externes

Les créateurs de la librairie Q ont documenté leur librairie avec d'[autres exemples](https://github.com/kriskowal/q) et un [wiki](https://github.com/kriskowal/q/wiki).

Ce projet github est aussi une bonne source d'informations : [https://github.com/bellbind/using-promise-q/](https://github.com/bellbind/using-promise-q/)

Enfin, une référence au callback hell : [http://callbackhell.com](http://callbackhell.com/)
