var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var FB = require('fb');

var _ = require('underscore');
var airports = require('./airports.json');
var Promise = require('promise');
var Twitter = require('twitter');
var SpotifyWebApi = require('spotify-web-api-node');
var pako = require('pako');
var mlDistance = require('ml-distance');
var mlKMeans = require('ml-kmeans');
var session = require('express-session');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var User = require("./models/user");
var MongoStore = require('connect-mongo')(session);
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

function generateOrFindUser(accessToken, refreshToken, profile, done) {
    console.log(profile.emails[0].value);
    if (profile.emails[0].value) {
        User.findOneAndUpdate({email: profile.emails[0].value}, {
            name: profile.displayName || profile.username,
            email: profile.emails[0].value,
            photo: profile.photos[0].value
        }, {upsert: true}, done);
    } else {
        var noEmailError = new Error("Your email privacy settings prevent you from signing into Bookworm.");
        done(noEmailError, null);
    }
}
// function generateOrFindUser(accessToken, refreshToken, profile, done){
//   if(profile.emails[0]) {
//     User.findOneAndUpdate(
//       { email: profile.emails[0] },
//       {
//         name: profile.displayName || profile.username,
//         email: profile.emails[0].value,
//         photo: profile.photos[0].value
//       },
//       {
//         upsert: true
//       },
//     done
//   );
//   } else {
//     var noEmailError = new Error("Your email privacy settings prevent you from signing into Bookworm.");
//     done(noEmailError, null);
//   }
// }

// passport.use(new GitHubStrategy({
//     clientID: process.env.GITHUB_CLIENT_ID,
//     clientSecret: process.env.GITHUB_CLIENT_SECRET,
//     callbackURL: 'http://localhost:3000/auth/github/return'
//   },
//   generateOrFindUser)
// );

var accessToken;
passport.use(new FacebookStrategy({
        clientID: "1439697042814402",
        clientSecret: "e135236cab7aa5c9f4cae0cf0184e698",
        callbackURL: "http://localhost:3000/auth/facebook/return",
        profileFields: ['id', 'displayName', 'photos', 'email']
    },
    function(access_token, refreshToken, profile, cb) {
        accessToken = access_token;
        return cb(null, profile);
    })
);

//user is mongoose model in our case
//null for the error
passport.serializeUser(function (user, done) {
    done(null, user._id)
});

passport.deserializeUser(function (userId, done) {
    User.findById(userId, done)
});


var routes = require('./routes/index');
var auth = require('./routes/auth');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/getFacebookProfile', function (req, res) {
    FB.api(
        "/johnny.nobles.7/feed",
        function (response) {
            if (response && !response.error) {
                console.log(response);
            }
        }
    );
});

app.get('/auth/login/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/return',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/');
    });



// mongodb connection
mongoose.connect("mongodb://localhost:27017/bookworm-oauth");
var db = mongoose.connection;


//Session config for Passport and MongoDB
var sessionOptions = {
    secret: "this is a super secret",
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({
        mongooseConnection: db
    })
};

app.use('/getSportEventsTickets', function (req, res) {
    var result = [];
    result.push({price: 120, from: {code: "HEL", name: "Helsinki"},
        to: {code: "SVO", name: "Moscow"},
        depart: new Date(2018, 11, 19, 9, 30),
        arrive: new Date(2018, 11, 19, 12, 0),
        event: {name:"FIFA 2018"}});
    result.push({price: 120, from: {code: "HEL", name: "Helsinki"},
        to: {code: "YNY", name: "Pyeongchang"},
        depart: new Date(2018, 1, 8, 15, 30),
        arrive: new Date(2018, 1, 8, 23, 0),
        event: {name:"Olympics 2018"}});
    res.send(result);
});

app.use('/getCarvinalsTickets', function (req, res) {
    var result = [];
    result.push({price: 120, from: {code: "HEL", name: "Helsinki"},
        to: {code: "GIG", name: "Rio-de-Janeiro"},
        depart: new Date(2018, 1, 7, 15, 30),
        arrive: new Date(2018, 1, 8, 4, 0),
        event: {name:"FIFA 2018"}});
    result.push({price: 120, from: {code: "HEL", name: "Helsinki"},
        to: {code: "TCI", name: "Tenerife"},
        depart: new Date(2018, 1, 6, 15, 30),
        arrive: new Date(2018, 1, 8, 18, 0),
        event: {name:"Carnival Tenerife"}});
    res.send(result);
});

//pass session options to session middleware
app.use(session(sessionOptions));

//initialize passport
app.use(passport.initialize());

//Restore session
app.use(passport.session());

// mongo error
db.on('error', console.error.bind(console, 'connection error:'));

app.use('/', routes);
app.use('/auth', auth);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


var spotifyApi = new SpotifyWebApi();
// access_token BQA390TX1j02M9Kus9b4xa7epgjLxWoAPDlmIQ7uriascciG9uMWqe-t4hfsHa_-O_JvwNDL2sG6CbNBxHlHKSAplQ2Hn8PndZcY1-r3ES9jIzEMRP7qfGevYL9iQ0oQO1Hd_jvJSJR3XAy7-YZnS75McL5F95L1243AKPc2f293_Q"
//only first 50
app.use('/getSpotiProfile', function (req, res, next) {
    if (req.query.access_token) {
        spotifyApi.setAccessToken(req.query.access_token);

        var artistNames = [];
        spotifyApi.getMySavedTracks({
            limit: 50
        })
            .then(function (data) {
                console.log(JSON.stringify(data, null, 15));
                _.each(data.body.items, function (item) {
                    _.each(item.track.artists, function (artist) {
                        artistNames.push(artist.name);
                    })
                });

                res.send(artistNames);

            }, function (err) {
                err.status = 500;
                next(err);
            });

        console.log(artistNames);

    } else {
        var err = new Error('Bad request - no access token');
        err.status = 400;
        next(err);
    }


});

app.use('/getWeatherBasedRecommends', function (req, res, next) {

    httpsRequest({
        hostname: 'api.finnair.com',
        port: 443,
        method: "GET",
        path: '/media-weather',
        agent: false
    }).then(function (forecast) {
        var result = [];
        var promise = new Promise.resolve();
        _.each(Object.keys(forecast), function (key) {

            promise = promise.then(function(){

                console.log(key);
                return httpsRequest({
                    hostname: 'instantsearch-junction.ecom.finnair.com',
                    port: 443,
                    method: "GET",
                    path: '/api/instantsearch/pricesforperiod?departureLocationCode=HEL&destinationLocationCode=' + key + '&startDate=2017-11-26&numberOfDays=5',
                    agent: false
                }).then(function (offer) {
                    console.log(offer);
                    if (offer){
                        var flightOffer = {};
                        flightOffer.days = [];

                        _.each(offer.prices, function (price) {
                            if (!price.noFlight && forecast[key].tx){
                                price.tx = forecast[key].tx;
                                flightOffer.days.push(price);
                            }
                        });

                        if (flightOffer.days.length > 0){
                            flightOffer.from = "HEL";
                            flightOffer.to = key;
                            result.push(flightOffer);
                        }
                    }
                    return Promise.resolve();
                })
            })
        });
        console.log(result);
    })
});



app.use('/getTwitProfile', function (req, res, next) {

    if (req.query.userDisplayName){
        var client = new Twitter({
            consumer_key: 'fVyFNrnGjn9Xm8UvTXnx6t09K',
            consumer_secret: 'BCqCuz2pQnXtdd7vETV6YRSpNEZEXCwTEmLwEyOmKvWwkJYt2t',
            access_token_key: '934384619302084608-j9p2fRQ4wYMUYkiQq8eMDs69jjM86vq',
            access_token_secret: 'kTcQq5azozTcXTuvsWUaYnM31uKWGSumF9DiQu4sCCffq'
        });

        var params = {screen_name: req.query.userDisplayName};
        client.get('statuses/user_timeline', params, function(error, tweets, response) {
            if (!error) {
                var result = {};
                result.usedHashtags = [];
                result.likedHashtags = [];
                _.each(tweets, function (tweet) {
                    _.each(tweet.entities.hashtags, function (hashtag) {
                        result.usedHashtags.push(hashtag.text);
                    })
                });
                client.get('favorites/list', {count: 200, screen_name: req.query.userDisplayName}, function (error, likedTweets, response) {
                    if (!error) {
                        _.each(likedTweets, function (likedTweet) {
                            _.each(likedTweet.entities.hashtags, function (hashtag) {
                                result.likedHashtags.push(hashtag.text);
                                res.send(result);
                            })
                        });
                    } else {
                        error.statusCode = 500;
                        res.error(error);
                    }
                })
            } else {
                error.statusCode = 500;
                res.error(error);
            }


        });
    } else {
        var error = new Error("Display name is required");
        error.statusCode = 422;
        next(error);
    }



});

app.use('/getUnofficialInstaProfile', function (req, res, next) {
    if (req.query.publicName){
        getHashtags(req.query.publicName).then(function (hashtags) {
            console.log(hashtags);
            res.send(hashtags);
        });
    } else {
        var err = new Error("PublicName is required");
        err.statusCode = 422;
        next(err);
    }
});


//access_token 1487858727.8302044.1bdbe8813233477080f14f7c26f337e3
app.use('/getInstaProfile', function (req, res, next) {
    if (req.query.access_token) {

        var now = Date.now();
        Promise.all([httpsRequest({
            hostname: 'api.finnair.com',
            port: 443,
            path: '/aws/locations/prod/all',
            agent: false
        }), httpsRequest({
            hostname: 'api.instagram.com',
            port: 443,
            method: "GET",
            path: '/v1/users/self/media/liked?access_token=' + req.query.access_token,
            agent: false
        })]).then(function (result) {
            console.log(Date.now() - now);
            var airportDatas = [];
            _.each(result[0].items, function (airport) {
                if (airports[airport.locationCode]) {
                    airport.country = airports[airport.locationCode].country;
                    airport.lat = airports[airport.locationCode].latitude;
                    airport.lon = airports[airport.locationCode].longitude;
                    airport.cosLat = Math.cos(airport.lat * (Math.PI / 180));
                    airportDatas.push(airport);

                }
            });

            console.log(Date.now() - now);
            var hashtags = {};
            var postLocations = [];
            _.each(result[1].data, function (item) {
                _.each(item.tags, function (tag) {
                    if (hashtags.hasOwnProperty(tag)) {
                        hashtags[tag]++;
                    } else {
                        hashtags[tag] = 1;
                    }
                });
                if (item.location) {
                    item.location.cosLat = Math.cos(item.location.latitude * (Math.PI / 180));
                    airportDatas.sort(
                        function (o1, o2) {
                            return getDistanceFromLatLonInKm(o1.lat, o1.lon, o1.cosLat, item.location.latitude, item.location.longitude, item.location.cosLat) -
                                getDistanceFromLatLonInKm(o2.lat, o2.lon, o2.cosLat, item.location.latitude, item.location.longitude, item.location.cosLat)
                        }
                    );
                    postLocations.push(
                        {
                            lat: item.location.latitude,
                            lon: item.location.longitude,
                            nearestAirport: airportDatas[0],
                            distanceToAirport: getDistanceFromLatLonInKm(airportDatas[0].lat, airportDatas[0].lon,
                                airportDatas[0].cosLat, item.location.latitude, item.location.longitude, item.location.cosLat)
                        }
                    );
                }
            });


            console.log(Date.now() - now);
            res.send({hashtags: hashtags, locations: postLocations});

        }).catch(function (err) {
            err.status = 500;
            next(err);
        });
    } else {

        var err = new Error('Bad request - no access token');
        err.status = 400;
        next(err);
    }
});


var R = 6371; // Radius of the earth in km
function getDistanceFromLatLonInKm(lat1, lon1, cosLat1, lat2, lon2, cosLat2) {

    var dLat = (lat2 - lat1) * (Math.PI / 180);
    var dLon = (lon2 - lon1) * (Math.PI / 180);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        cosLat1 * cosLat2 *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


function httpsRequest(params, postData) {
    return new Promise(function (resolve, reject) {
        var req = https.get(params, function (res) {
            // reject on bad status
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            // cumulate data
            var body = [];
            res.on('data', function (chunk) {
                body.push(chunk);
            });
            // resolve on end
            res.on('end', function () {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch (e) {
                    reject(e);
                }
                resolve(body);
            });
        });
        // reject on request error
        req.on('error', function (err) {
            reject(err);
        });
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}


// var hashtagCount = {};
// _.each(["anaa", "eltarf", "norresundby", "malamala", "aynalfaydah", "novorossiysk", "kolind", "altay", "araxá", "alghaydah", "abakan",
//         "albacete", "abadan", "allentown", "abilene", "abidjan", "kabridar", "kiana", "seisia", "albuquerque", "aberdeen", "abusimbel",
//         "alaqiq", "gwagwa", "albury", "albany", "aberdeen", "acapulco", "accra", "sanbartolomé", "altenrhein", "st.peterport", "nantucket",
//         "sahand", "achinsk", "waco", "mckinleyville", "xingyi", "eggharborcity", "zabol", "adana", "azmir", "addisababa", "ashshaykhuthman",
//         "adiyaman", "amman", "adak", "adelaide", "kodiak", "ardabil", "st.andrews", "sanandrés", "abéché", "buenosaires", "sochi", "vigra",
//         "allakaket", "alexandria", "akureyri", "sanrafael", "altafloresta", "zarafshan", "afutara", "sabzevar", "agadir", "laplume", "angelholm",
//         "wanigela", "angmassalik", "angoon", "malaga", "agra", "augusta", "presidentefranco", "aguascalientes", "acarigua", "agattiisland", "hajlah",
//         "herlong", "ahe", "alghero", "auas", "alhoceima", "alliance", "wainwright", "aitutaki", "atiuisland", "ajaccio", "sakakah", "agrı", "aizawl", "anjouan",
//         "arvidsjaur", "aracaju", "ankang", "atka", "kufrah", "bethel", "asahikawashi", "kodiak", "manukaucity", "kingsalmon", "anaktuvukpass", "kroonstad", "aksu",
//         "chisasibi", "aqtobe", "sittwe", "almaty", "latham", "elx", "alta", "algiers", "albany", "alamogordo", "waterloo", "djibrine", "alamosa", "wallawalla",
//         "alexandria", "alitak", "amarillo", "ahmedabad", "arbamintch", "mataram", "amman", "ambon", "schipholzuid", "nar'yanmar", "ambatomainty", "anchorage",
//         "seichessurleloir", "antofagasta", "champniers", "bethel", "antalaha", "antwerp", "carlisle", "anvik", "andenes", "altenburg", "eskişehir", "falconaramarittima",
//         "aomorishi", "karpathos", "martinsburg", "kepalabatas", "amook", "englewood", "naples", "apataki", "nampula", "alpena", "apartadó", "apia", "anqing", "qaisumah", "aqaba", "arequipa", "arcticvillage", "alorisland", "arkhangel'sk", "arica", "arusha", "armidale", "märst", "dexter", "araçatuba", "woodruff", "arad", "assab", "ashgabat", "freshcreek", "aspen", "astrakhan'", "georgetown,ascensionisland", "amamioshima", "asmara", "asosa", "alicesprings", "kayseri", "coloniamarianoroquealonso", "amboseli", "aswan", "atbara", "arthurtown", "atoifi", "athens", "atqasuk", "atlanta", "altamira", "rajasansi", "atar", "atmautluak", "appleton", "watertown", "asyut", "aruba", "arauca", "augusta", "abudhabi", "alakanuk", "atuona", "aurillac", "austin", "araguaina", "aneityum", "fletcher", "avignon", "pittston", "avuavu", "lara", "awaba", "aniwa", "ahvaz", "anguilla", "alexandroupolis", "latebaida", "springpoint", "arutua", "akitashi", "axum", "ayersrock", "antalya", "phoenix", "yezd", "andijon", "kalamazoo", "adrar", "samana", "baguiocity", "almuharraq", "batman", "soledad", "balalae", "bauru", "baotou", "barnaul", "baiamare", "balmaceda", "bhubaneswar", "kasane", "nangamedamit", "berbera", "camberley", "bucharest", "baracoa", "bacolodcity", "barcaldine", "colorado", "bacæu", "elpratdellobregat", "st.george", "bundaberg", "baduisland", "bandarabbas", "banjarmasin", "windsorlocks", "bandung", "bhadrapur", "vadodara", "stratford", "brindisi", "bardufoss", "balivanich", "surčin", "belem", "benghazi", "guipavas", "bethel", "bedourie", "beira", "beirut", "lewisrun", "bielefeld", "scottsbluff", "seattle", "bakersfield", "bloemfontein", "crumlin", "buriram", "bucaramanga", "bangui", "bridgetown", "johnsoncity", "blomsterdalen", "bangor", "baghdad", "grassobbio", "ellsworth", "belfast", "blenheim", "bruslaguna", "bisha", "puntaalta", "bhuj", "bukhara", "birmingham", "bhopal", "brokenhill", "bharatpur", "bathurst", "bhavnagar", "bahawalpur", "birmingham", "beihai", "borgo", "blockisland", "bikiniatoll", "biak", "billings", "bailey'stown", "loiu", "anglet", "biratnagur", "bismarck", "bejaia", "bojnord", "baasfjord", "bemidji", "yundum", "bujumbura", "bahardar", "bodrum", "ende", "silao", "badajoz", "lyubertsy", "buckland", "kotakinabalu", "laksi", "cleveland", "bakalalan", "kalaban", "mountenniskillen", "bengkulu", "beaver", "bukavu", "pariaguán", "borlange", "bellingham", "batna", "blackpool", "billund", "bologna", "bangalore", "baralaba", "belleville", "lunzu", "bromma", "broome", "bloomington", "borkum", "bhamo", "raba", "banmethuot", "bordjbadjimokhtar", "belepisland", "nashville", "bandarabbas", "brisbane", "benincity", "bonn", "ballina", "bronnoysund", "barinas", "banjaluka", "bellona", "papeete", "bocasdeltoro", "merignac", "fontibón", "christchurch", "boise", "burgas", "mumbai", "kralendijk", "bodo", "boston", "bartow", "bobodioulasso", "balikpapan", "portoseguro", "beaumont", "qamdo", "besalampy", "brunswick", "boulia", "aguadilla", "blagoveshchensk", "barreiras", "sancarlosdebariloche", "brainerd", "bremen", "bradford", "bari", "bourke", "burlington", "barquisimeto", "belp", "brownsville", "brno", "barra", "bristol", "bruxelles", "badbederkesa", "barrow", "bossaso", "lagosul", "bahíasolano", "baoshan", "bata", "brighton", "biskra", "stludwig", "basco", "gawad", "bassein", "batam", "kaktovik", "bandaaceh", "bratsk", "battlecreek", "butte", "batonrouge", "bratislava", "bettles", "bintulu", "southburlington", "bursa", "buka", "burketown", "budapest", "buffalo", "bulolo", "buenaventura", "burao", "bulawayo", "burbank", "batumi", "bunia", "bandarebushehr", "beauvais", "boavista", "boavista", "brivelagaillarde", "berlevaag", "vilhena", "birdsville", "bhairawa", "braunschweig", "barrowinfurness", "baltimore", "bol", "bandarseribegawan", "doctorsrocks", "santaclara", "bam", "buenavista", "bayamo", "bayankhongor", "hattieville", "białebłota", "briansk", "barisal", "bozeman", "botzen", "villeneuve", "brazzaville", "carterton", "cabinda", "cascavel", "westcolumbia", "sardara", "camau", "cairo", "canton", "campbeltown", "guangzhou", "caphaïtien", "carlisle", "cayenne", "canbelego", "cochabamba", "cambridge", "bechar", "sultankudarat", "duketown", "canberra", "catumbela", "cayococo", "carcassonne", "pallikkal", "westisland", "forquilhinha", "hualpencillo", "catialamar", "kolkata", "craigcove", "chubcay", "coldbay", "cedarcity", "lemesnilamelot", "chadron", "cordova", "fairfield", "cebu", "crescentcity", "ceduna", "cherepovets", "chester", "chiangrai", "zlatoust", "circle", "ciudadobregón", "cortez", "caçador", "aulnat", "chlef", "mullaghduff", "carpiquet", "coffsharbour", "corcyra", "craig", "cuiaba", "changde", "saopaulo", "scottcity", "tangerang", "camiguin", "cologne", "zhengzhou", "chittagong", "changchun", "campogrande", "cagayandeoro", "chattanooga", "christchurch", "earlysville", "canea", "northcharleston", "chathamisland", "chuathbaluk", "choiseulbay", "rome", "chico", "cedarrapids", "chifeng", "changzhi", "cobija", "chalkyitsik", "chipata", "shimkent", "kincheloe", "canouanisland", "chiclayo", "cajamarca", "coimbatore", "calama", "naesueup", "chitral", "ciudadjuarez", "jejusi", "clarksburg", "aniak", "chongqing", "chokurdah", "carajas", "tok", "conakry", "canakkale", "carlsbad", "cleveland", "clausemburgo", "collegestation", "portangeles", "obando", "clarkspoint", "cuauhtémoc", "charlotte", "calenzana", "cunnamulla", "gampaha", "carmenolorón", "lamotte", "corumba", "columbus", "savoy", "casablanca", "kundiawa", "camagüey", "hancock", "coonamble", "coconutisland", "kustenje", "confins", "cloncurry", "carlsbad", "neerleritinaat", "corrientes", "cairns", "chiangmai", "thompson", "codyyellowstone", "kochi", "isleofcoll", "cotonou", "choibalsan", "cordoba", "coloradosprings", "columbia", "sanmartindelosandes", "cooberpedy", "campeche", "kastrup", "copiapó", "campinas", "casper", "capetown", "campinagrande", "culebra", "shahrekord", "croiova", "comodororivadavia", "colonelhill", "mabalacat", "charleroi", "catarman", "corpuschristi", "charleston", "isleofcolonsay", "columbus", "solovetsky", "capskirring", "changsha", "cheboksary", "catania", "sanisidro", "laboquilla", "charleville", "chetumal", "chitoseshi", "chengdu", "cúcuta", "cuenca", "fossano", "cayecaulker", "culiacan", "cumaná", "cancun", "elpilar", "curacao", "chihuahua", "sansebastián", "hebron", "güémez", "texico", "carnarvon", "coventry", "corvo", "mosinee", "saojosedospinhais", "chernivtsi", "barry", "cox'sbazar", "vancouver", "christmasisland", "caxiasdosul", "nhatrang", "caymanbracis", "chefornak", "chiayicity", "cayolargodelsur", "calbayog", "cheyenne", "cuyo", "cherskiy", "cauayan", "laveladecoro", "corozal", "constantine", "sanmigueldecozumel", "gakona", "cruzeirodosul", "morroa", "changzhou", "daytonabeach", "dhaka", "tourane", "dallas", "damascus", "daressalaam", "datong", "daru", "daxian", "dayton", "dalbandin", "dubbo", "dubuque", "dubrovnik", "arlington", "portsmouth", "labruguière", "dodgecity", "dandong", "deraghazikhan", "decatur", "dehradun", "dezful", "newdelhi", "denver", "dayrazzawr", "dallas", "dangriga", "appletreeflat", "dongguan", "durango", "sibulan", "dharamsala", "dothan", "dikhari", "antseranana", "diqing", "dickinson", "dili", "dienbienphu", "diredawa", "loubomo", "diu", "diyaribakir", "jambi", "hawmatassuq", "illizi", "jayapura", "ngor", "douala", "dalian", "dillingham", "duluth", "lamdong", "ortaca", "dalicity", "dillonsbay", "dalanzadgad", "doomadgee", "podol'sk", "donmuang", "khuwaylidiyah", "dimapur", "dundee", "dunhuang", "dnipropetrovs'k", "pleurtuit", "denizli", "dongola", "doha", "donets'k", "marigot", "dolpa", "dourados", "dongying", "polanco", "devonport", "denpasar", "deering", "durango", "ottendorfokrilla", "delrio", "darwin", "doncastersheffield", "desmoines", "dongsheng", "dortmund", "detroit", "cloghran", "outram", "dundo", "reynoldsville", "duncan", "durban", "dusseldorf", "unalaska", "devilslake", "davaocity", "soalala", "dawadmi", "dubai", "dayong", "anadyr'", "dushanbe", "mamoudzou", "zhezqazghan", "tok", "emae", "kwajaleinatoll", "najran", "kearney", "hondarribia", "eastwenatchee", "eauclaire", "pianosa", "entebbe", "alubayyid", "esbjerg", "erbil", "nicosia", "ketchikan", "edinburgh", "nakuru", "edremit", "edwardriver", "eek", "dhilianata", "bergerac", "gypsum", "geneina", "belgorod", "egilsstadir", "eagleriver", "egegik", "eisenach", "eniseysk", "tonsberg", "eindhoven", "beefisland", "barrancabermeja", "wedjh", "elko", "darwin", "elfasher", "elgolea", "thebluff", "elim", "horseheads", "elpaso", "alqara'", "eastlondon", "eloued", "elfincove", "ely", "derby", "emerald", "emden", "alakanuk", "kenai", "ende", "leppäjärvi", "enshi", "elnido", "enschede", "enugu", "kenosha", "yan'an", "medellin", "elorza", "gibson", "esquel", "erzincan", "erfurt", "errachidia", "erie", "erechim", "windhoek", "erzurum", "çubuk", "escanaba", "eastsound", "tachina", "diegodealmagro", "mulheimonruhr", "essaouira", "elat", "verny", "eua", "eugene", "bordesholm", "laayoune", "oranjestad", "tarnstad", "sveg", "yerevan", "evansville", "newbedford", "wildmanlake", "newbern", "newark", "exeter", "yopal", "keywest", "ezeiza", "elazığ", "farnborough", "faroeislands", "fairbanks", "faro", "fargo", "fresno", "fakarava", "fayetteville", "lubumbashi", "kalispell", "cuxhaven", "rome", "bygstad", "ducos", "meckenbeuren", "fergana", "viladosremédios", "fez", "fangatau", "fakahina", "kinshasa", "alfujayrah", "rheinmünster", "kisangani", "franklin", "fakfak", "sukagawashi", "florencia", "flagstaff", "daniabeach", "florianopolis", "florence", "florence", "floresisland", "formosa", "memmingen", "farmington", "greven", "fortmyers", "freetown", "madeira", "stgillesdugard", "sunan", "loveland", "flint", "fuzhou", "fortdodge", "foggia", "fortaleza", "freeportcity", "frankfurt", "franca", "fridayharbor", "feraisland", "forli", "floro", "flores", "bishkek", "francistown", "figari", "siouxfalls", "fortsmith", "stpierre", "futunaisland", "elcalafate", "faradofay", "antigua", "fuyang", "gotoshi", "fukuokashi", "funafuti", "futunaisland", "fortwayne", "fortwilliam", "fortyukon", "bristol", "gabes", "gafsa", "higashineshi", "galena", "gambell", "hithadhoo", "guantanamo", "gawahati", "gamba", "gaya", "greatbend", "tlokweng", "grandbourg", "gorgan", "gillette", "st.peterport", "pierceville", "georgetown", "godeiddidole", "tlajomulcodezúñiga", "gdansk", "barinas", "azezo", "grandturk", "magadan", "noumea", "spokane", "santoangelo", "hydepark", "nuevagerona", "generalsantoscity", "geraldton", "koskullskulle", "griffith", "grandforks", "grafton", "longview", "georgetown", "ghardaia", "governorharbour", "ghat", "gibraltar", "kubinvillage", "riodejaneiro", "gilgit", "gisborne", "jizan", "guanaja", "jijel", "grandjunction", "goroka", "paisley", "palmarsur", "greenville", "gaalkacyo", "goulimime", "cheltenham", "gladstone", "golovin", "gemena", "gambela", "seoul", "gambieris", "alajeró", "sillans", "grenada", "goodnewsbay", "gainesville", "genoa", "nuuk", "vascodagama", "dzerzinsk", "goma", "gorakhpur", "golmud", "härryda", "garoua", "gove", "lakkopetra", "guapí", "puertoayora", "gulfport", "greenbay", "george", "killeen", "vilobíd'onyar", "eelde", "grandrapids", "guarulhos", "groznyy", "graciosaisland", "chauchina", "akureyri", "feldkirchen", "kyrkobyn", "gheshm", "greensboro", "greer", "gustavus", "marketrasen", "gatokae", "darwin", "greatfalls", "gorontalo", "columbus", "granites", "guatemalacity", "gunnison", "hagåtña", "alotau", "atyrau", "geneva", "governadorvaladares", "gawadar", "gwalior", "westerland", "carnmore", "seiyun", "negage", "guayaramerín", "baku", "guayaquil", "argyle", "guaymas", "goiania", "gizo", "oğuzeli", "hasvik", "hachijomachi", "hamstad", "havasupai", "hahaia", "langenhagen", "haikou", "hamburg", "hanoi", "hanimaadhoo", "ha'il", "avaldsnes", "wajay", "hobart", "alexandria", "hafralbatin", "hubli", "hengchun", "holycross", "heidelberg", "hyderabad", "heringsdorf", "hamadan", "hayden", "phalaborwa", "hatyai", "herat", "heho", "heidebuesum", "heihe", "vantaa", "iraklio", "hohhot", "hefa", "hefei", "hagfors", "hammerfest", "hargeysa", "hughenden", "hangzhou", "helgoland", "maehongson", "mounthagen", "hiltonheadisland", "dickenschied", "huahin", "hikueru", "hibbing", "hornisland", "miharashi", "shillavo", "sacheonsi", "honiara", "haymanisland", "zhijiang", "khajuraho", "healylake", "hakodateshi", "hongkong", "hokitika", "kimbe", "thalang", "johannesburg", "hailar", "ulanhot", "helena", "holyhead", "hamilton", "khantymansiysk", "ouargla", "hermosillo", "hemavan", "hanamakishi", "tokyo", "hoonah", "honolulu", "hana", "haines", "hobbs", "alhudaydah", "houeisay", "alahsa", "sanpedrodecacocum", "hohenems", "papeete", "homer", "huron", "hof", "horta", "houston", "hovdebygda", "pangai", "hooperbay", "häiphòng", "purchase", "harbin", "harare", "borsafajah", "kharkiv", "harlingen", "harrogate", "saga", "huslia", "shenjiamentown", "huntsville", "chita", "dudinka", "hamiltonisland", "hotan", "huntington", "papeete", "hue", "hualiencity", "houn", "hughes", "hudiksvall", "santodomingodemorelos", "ulceby", "huizhou", "analalava", "herveybay", "khovd", "honningsvåg", "easthaven", "havre", "hyannis", "hyderabad", "hydaburg", "hollis", "huangyan", "hays", "hanzhong", "lipingcity", "igarka", "washington", "niagarafalls", "houston", "illizi", "kiana", "ilasi", "ibadan", "ibague", "sanjosé", "cicia", "incheon", "wichita", "idahofalls", "indore", "babimost", "kiev", "isafjordur", "esfahan", "ivanofrankivs'k", "bullheadcity", "matthewtown", "igiugig", "kingman", "puertoesperanza", "ingolstadtmanching", "fozdoiguacu", "iranshahr", "ilaam", "izhevsk", "tehran", "nikolski", "tiksi", "irkutsk", "nelsonhouse", "iliamna", "wilmington", "wilmington", "iloilo", "vao", "ilorin", "glenegedale", "bytča", "lilong(imphalwest)", "simikot", "imperatriz", "kingsford", "yinchuan", "indianapolis", "inhambane", "nis", "internationalfalls", "innsbruck", "winstonsalem", "yaren", "inverness", "insalah", "ioannina", "castletown", "impfondo", "ilhéus", "ipota", "easterisland", "ipoh", "ipiales", "imperial", "santanadoparaíso", "montoursville", "ipswich", "qiemo", "qingyang", "altohospicio", "iquitos", "kirakira", "circle", "chamical", "irma", "mountisa", "råwalpindi", "ramsvalley", "ishigakishi", "williston", "kinston", "ronkonkoma", "bakırköy", "ithaca", "itamishi", "hilo", "niueisland", "invercargill", "ivalo", "inverell", "ironwood", "iwami", "gandhigram", "bagdogra", "bhabat", "allahabad", "mulur", "kangrali", "lilabari", "jammucantt", "leh", "harveypatti", "ranchi", "tarapur", "aurangabad", "jamshedpur", "gandhidham", "portblair", "inyokern", "hikawacho", "jackson", "jaipur", "jalapa", "pearl", "ilulissat", "jacksonville", "joaçaba", "qasigiannguit", "juliacreek", "ceuta", "juizdefora", "jodhpur", "juazeirodonorte", "jingdezhen", "jeddah", "holtssummit", "aasiaat", "jeh", "st.peter", "jamaica", "paamiut", "jamnagar", "williams", "jiayuguan", "qeqertarsuaq", "jian", "senai", "jinghong", "lahaina", "sisimiut", "jamestown", "djibouticity", "jijiga", "evdilos", "jimma", "jiujiang", "jinjiang", "qaqortoq", "jonkoping", "khios", "jackson", "landskrona", "webbcity", "bilpura", "mikonos", "jamestown", "jiamusi", "johannesburg", "nanortalik", "narsaq", "juneau", "naxos", "jinzhou", "ylämylly", "yogyakarta", "joinville", "jolo", "santarita", "jiparaná", "qaarsut", "newyork", "senchoagaon", "sanya", "jaisalmer", "seteia", "skiathos", "jessore", "johnstown", "maitsoq", "anosiros", "emborion", "astypalaea", "juba", "santacatalina", "juliaca", "jumla", "upernavik", "juzhou", "ankavandra", "jiroft", "tikkakoski", "songpan", "kariba", "alqamishli", "afaka", "paltaniemi", "kaltag", "", "kuusamo", "kaitaia", "kawthaung", "kalbarri", "birchcreek", "kabul", "kiev", "kotabaharu", "krabi", "kuqa", "coffmancove", "kadanwari", "chigniklagoon", "kuching", "chigniklagoon", "kahramanmaraş", "chignik", "nankokushi", "alaqadaridaman", "kendari", "kerdlya", "kaadedhdhoo", "kadhdhoo", "skardu", "kandavu", "nanwalek", "reykjavik", "kemerovo", "ekwok", "kemi", "nepalganj", "kerman", "kengtung", "keewaywin", "kiffa", "falsepass", "kananga", "kingscote", "kaliningrad", "kagau", "qaraghandy", "kalgoorlie", "newkoliganek", "kigali", "kogalym", "antimacheia", "grayling", "kashi", "kaohsiungcity", "karachi", "khamti", "nanchang", "khasab", "khabarovsk", "khoy", "kauehi", "tollarp", "casummitlake", "bandarabbas", "niigatashi", "kirkuk", "kimberley", "kingston", "farranfore", "kisumu", "potamoskythiron", "chisinau", "tajiricho", "kansk", "koyuk", "kitoibay", "khonkaen", "kokoda", "kerikeri", "kongiganak", "akiachak", "kitakyushu", "hesseng", "kaukuraatoll", "clarkspoint", "kalskag", "kolhapur", "levelock", "larsenbay", "kalibo", "kalmar", "celovec", "carlsbad", "klawock", "kalamae", "kerema", "kingkhalidmil.city", "kamembe", "kunming", "miyazakishi", "kikuyomachi", "manokotak", "komatsushi", "newtafo", "kalemyo", "moserbay", "kindu", "kingslynn", "kaimana", "kinmen", "kakhonak", "kone", "kingisland", "kanpur", "newstuyahok", "durack", "kailuakona", "koumac", "kupang", "kirkwall", "kirishimashi", "kruunupyy", "nakhonphanom", "kotlik", "koulamoutou", "ganzhou", "olgabay", "ouzinkie", "pointbaker", "brevigmission", "kipnuk", "pohangsi", "portwilliams", "perryville", "portbailey", "akutan", "nyland", "kikori", "zabierzów", "korla", "kiruna", "kårup", "krasnodar", "kjevic", "khartoum", "karamay", "tofol", "kosice", "karlstad", "kalden", "kermanshah", "st.marina", "kassala", "saintmarys", "qostanay", "argosorestiko", "qarshi", "kristiansundnord", "kars", "vel'sk", "karratha", "thornebay", "kerteh", "kathmandu", "ketchikan", "tellermission", "kittila", "ożarowice", "gambang", "kudat", "syzran'", "kubinisland", "kushiro", "kasigluk", "sepang", "kovno", "toivala", "kulusuk", "kutaisi", "bhuntar", "gunsansi", "khrysoupolis", "väring", "kingcove", "gyandzha", "kavieng", "kirovsk", "kivalina", "carpiquet", "kwajalein", "guiyang", "kuwaitcity", "gwangju", "kwigillingok", "guilin", "kowanyama", "quinhagak", "westpoint", "kwethluk", "kolwezi", "kasaan", "koroisland", "komsomol'sknaamure", "katiu", "konya", "kodiak", "miltonkeynes", "kyaukpyu", "kayes", "koyukuk", "kyzyl", "zacharbay", "kozani", "zelenodol'sk", "kzylorda", "kastelorizo", "luanda", "lae", "lannion", "lages", "hayriver", "lansing", "sannicolas", "lapaz", "beida", "laramie", "lasvegas", "lamu", "lawton", "losangeles", "leeds", "lubbock", "lubeque", "khudzhand", "latrobe", "northplatte", "ende", "liberal", "longbanga", "labasa", "victoria", "libreville", "larnaca", "laceiba", "sesteban", "lakecharles", "lodz", "columbus", "lachorrera", "longyan", "london", "londrina", "juillan", "leshukonskoye", "lordhoweisland", "lamidanda", "lahaddatu", "landivisiau", "londonderry", "learmonth", "westlebanon", "st.petersburg", "lehavre", "almeria", "schkeuditz", "leon", "sirsamuel", "leticia", "bureta", "lexington", "lamerd", "lafayette", "lome", "flushing", "longbeach", "velroux", "deadmanscay", "kuah", "longlellang", "daraga", "lagoagrio", "horley", "lahore", "lightningridge", "hounslow", "lanzhou", "wé", "limoges", "lihue", "fretin", "ventanilla", "peschieraborromeo", "pto.limon", "liberia", "lisbon", "littlerock", "loikaw", "lijiangcity", "ljubljana", "larantuka", "lakeba", "seattle", "lokichoggio", "longakah", "lakeselv", "leknes", "lucknow", "lulea", "lingling", "lalibela", "alluitsuppaa", "lumbadzi", "lakeminchumina", "sanjuandearama", "ahome", "limbang", "caltabellotta", "klamathfalls", "lakemurray", "lamenbay", "panngi", "lincang", "lincoln", "leonora", "lihirisland", "lanaicity", "hoersching", "longana", "loja", "ikeja", "louisville", "frontera", "telde", "lapaz", "lapedrera", "linkoping", "lipetsk", "liverpool", "lamap", "lappeenranta", "louangphrabang", "lopezisland", "lampang", "liepaya", "lepuy", "puertoleguízamo", "laredo", "longreach", "larochelle", "laromana", "lar", "lero", "ploemeur", "losuia", "compañíaalta", "lacrosse", "lashio", "shetland", "laspiedras", "troisrivières", "blessington", "lismore", "ghadames", "altai", "djeble", "luton", "comondú", "grimaud", "latacunga", "solukhumbu", "luderitz", "webb", "agno", "luxi", "lusaka", "luena", "kalaupapa", "villageneralroca", "pointhope", "langgur", "sandweiler", "livingstone", "laverton", "lewisburg", "lewoleba", "gyumri", "l'viv", "lewiston", "lewistown", "lawas", "lhasa", "luangnamtha", "luxor", "moudhros", "luoyang", "littlecayman", "lyoksele", "lianyungang", "lynchburg", "linyi", "shahfaisalabad", "longyearbyen", "colombier", "arteaga", "linzhou", "nangan", "luzhou", "kanchipuram", "marabá", "madrid", "midland", "madang", "mao", "majuro", "malakal", "matamoros", "manchester", "manaus", "maracaibo", "lorengau", "papeete", "mayaguez", "mombasa", "mmabatho", "monbetsushi", "maryborough", "montegobay", "manistee", "freeland", "masbate", "mbambanakira", "merced", "mcgrath", "kansascity", "mccook", "monacoville", "macon", "orlando", "macapá", "muscat", "mcarthurriver", "clearlake", "khasavyurt", "mudjimba", "maceio", "manado", "ríonegro", "mudanjiang", "mbandaka", "mandalay", "mardelplata", "lorimers", "middletown", "mendi", "chicago", "mendoza", "macae", "manta", "almadinah", "tadine", "malanje", "mehavn", "meridian", "melbourne", "memphis", "medan", "mexicocity", "meghauli", "mcallen", "moala", "matsu", "macau", "centralpoint", "mfuwe", "tipitapa", "mountgambier", "maringa", "portshepstone", "montgomery", "mogadishu", "mangaiaisland", "milingimbi", "morgantown", "mergui", "mashhad", "mannheim", "marshharbour", "manhattan", "minsk", "maarianhamina", "mather", "manchester", "miami", "mérida", "mianyang", "marilia", "merimbula", "sidialghudamisi", "misimaisland", "manja", "mohenjodaro", "mosjoen", "mitiga", "monkeymia", "mouila", "mbujimayi", "mahajanga", "mitilini", "sanjavier", "mirnyj", "kansascity", "milwaukee", "muskegon", "hoolehua", "mukah", "makemo", "merauke", "kumarina", "makokou", "manokwari", "mackay", "curmi", "melbourne", "male", "malang", "baselmulhousefreiburg", "coalvalley", "marshall", "álvaroobregón", "melilla", "apollonia", "monroe", "monrovia", "arga", "manleyhotsprings", "ozoracho", "darlington", "mountmagnet", "mammothlakes", "apatity", "viladomaio", "svedala", "miyakojima", "manaisland", "maningrida", "mananjary", "parañaque", "minto", "moulmein", "moa", "mobile", "montesclaros", "modesto", "maumere", "monghsat", "mitiaroisland", "bolsøya", "morondava", "minot", "mountainvillage", "moranbah", "papeete", "mpacha", "caticlan", "mauguio", "maputo", "mountpleasant", "chelyabinsk", "mildura", "mardin", "skonseng", "nelspruit", "marquette", "makale", "misratah", "ejido", "maralodges", "marignane", "mahebourg", "mineralnyevody", "monterey", "moree", "muskratdam", "manston", "misawashi", "muscleshoals", "madison", "missoula", "st.paul", "minsk", "mush", "massena", "maastrichtairport", "maseru", "massawa", "kenner", "namibe", "montrose", "metlakatla", "losgarzones", "manzini", "minatitlan", "motalava", "pesquería", "munda", "maun", "oberding", "kamuela", "marsamatruh", "maukeisland", "aguasay", "miri", "multan", "musoma", "franceville", "montevideo", "mitu", "maroua", "mucuri", "mataiva", "vineyardhaven", "marion", "maewo", "mwadui", "magwe", "ilemera", "moro", "mexicali", "morombe", "morlaix", "cardanoalcampo", "maintirano", "mörön", "mora", "meixian", "bingie", "mombasa", "miyakemura", "abrahambay", "murrayisland", "matsuyamashi", "mccall", "myrtlebeach", "myitkyina", "mekoryuk", "ziwani", "miri", "makungcity", "merzifon", "mopti", "villamaría", "manzanillo", "mazarisharif", "mazatlán", "mulu", "bohenacreek", "naracoorte", "nagpur", "nakhichevan", "nadi", "nanchong", "naples", "qaanaaq", "nassau", "natal", "napukaisland", "nevsehir", "narathiwat", "naberevnyechelny", "nairobi", "caimanera", "nabire", "bottlecreeksettlements", "nice", "newcastle", "newchenega", "nukus", "pringy", "portetienne", "qiqihar", "n'djamena", "nador", "neryungri", "nevis", "", "jiangshan", "ngaoundéré", "ngauisland", "tokonameshi", "omurashi", "nhatrang", "nukuhiva", "nikolai", "niamey", "jacksonville", "honolulu", "nizhnevartovsk", "nouakchott", "nanjing", "naukiti", "toyoyamacho", "ndola", "nuevolaredo", "kubinvillage", "nelsonlagoon", "kingston", "mykolayiv", "namangan", "nightmute", "santaana", "wuxu", "nondalton", "naryanmar", "nan", "nanyang", "nosara", "knock", "nojabrxsk", "hellville", "", "huambo", "novokuznetsk", "napier", "newplymouth", "neuquen", "nuquí", "newquay", "narrandera", "norrkoping", "weeze", "naritashi", "nowshahr", "yaounde", "kansk", "nelson", "phraphrom", "bouguenais", "nantong", "ferodale", "normanton", "anamizumachi", "niuatoputapu", "nuremberg", "nuiqsut", "nukutavake", "nulato", "nunapitchuk", "norsup", "novyurengoy", "neiva", "navoi", "narvik", "novgorod", "navegantes", "moheli", "norwich", "norwoodyoungamerica", "nyeri", "nadym", "nykoping", "nyaungu", "manzhouli", "arthurville", "richlands", "oakland", "oamaru", "sanbernardomixtepec", "oban", "obihiroshi", "kobuk", "obo", "chontapunta", "longseridan", "odesa", "oakharbor", "oudomxay", "husum", "ouangofitini", "kahului", "yonagunicho", "ogdensburg", "ouargla", "mozdok", "ohrid", "hamburg", "okhotsk", "oshimamachi", "kunisakishi", "nahashi", "oklahomacity", "sapporoshi", "okayamashi", "yorkeisland", "oakey", "orland", "terranova", "wolfpoint", "oldharbor", "olpoi", "roxbydowns", "omaha", "omboue", "ormoc", "oranjemund", "nome", "urmieh", "mostar", "oradeamare", "omsk", "ondangwa", "mornington", "kitakitashi", "o'neill", "ontario", "toksookbay", "goldcoast", "opalocka", "maia", "sinop", "balimo", "orebro", "chicago", "norfolk", "worcester", "portlions", "rera", "fivemilebridge", "northampton", "oranrp", "noorvik", "paris", "frösö", "osijek", "fårbo", "gardermoen", "mosul", "mošnov", "osh", "oostende", "orsk", "namsos", "sianów", "northbend", "bucharest", "coto47", "kotzebue", "ouagadougou", "oujda", "ouesso", "oulunsalo", "zouerate", "novosibirsk", "castrillón", "boscobel", "bissau", "kidlington", "oxnard", "oyem", "moyo", "ozamiscity", "zaporizhzhya", "ouarzazate", "büren", "westpaducah", "pailin", "portauprince", "levkai", "patna", "castillodeteayo", "tlaltenango", "porbandar", "plattsburgh", "paro", "westpalmbeach", "paama", "sabakoe", "paraburdoo", "puntaislita", "putao", "paintercreek", "callaria", "puertocarreño", "guaviare", "pedrobay", "padang", "pontadelgada", "puntadeleste", "piedrasnegras", "pendleton", "portland", "pelican", "pardubice", "perm'", "assisi", "pereira", "shunyi", "puertomaldonado", "batumaung", "perth", "petrozavodsk", "pelotas", "puertolempira", "peshawar", "ukhta", "penza", "passofundo", "panamacity", "paphos", "parsabad", "page", "perpignan", "pangkalpinang", "portgraham", "asalouyeh", "greenville", "stpierre", "portharcourt", "porthedland", "newportnews", "portharcourt", "philadelphia", "pointhope", "phitsanulok", "phalaborwa", "phoenix", "peoria", "moselle", "clearwater", "pingtung", "pocatello", "prestwick", "parintins", "pilotpoint", "pierre", "vouneuilsousbiard", "coraopolis", "piura", "nelsonhouse", "madalena", "pointlay", "pajala", "panjgur", "puertojiménez", "napaskiak", "williamstown", "elizovo", "parkes", "pangkor", "pakokku", "pukapuka", "pokhara", "pekanbaru", "buntok", "pakxe", "nicoya", "plymouth", "placencia", "palembang", "pellston", "portlincoln", "klaipedapalanga", "thebightsettlements", "belohorizonte", "palu", "semipalatinsk", "portelizabeth", "pemba", "losquemas", "palmdale", "portsmouth", "parma", "palma", "portmoller", "cinisi", "palmerstonnorth", "pampatar", "palmas", "puertomadryn", "palmarsur", "noáin", "puntagorda", "phnompenh", "palikir", "pontianak", "pantelleria", "popondetta", "pune", "pointenoire", "pensacola", "petrolina", "portoalegre", "portgentil", "pemba", "portmoresby", "sanfelipedepuertoplata", "pori", "trinidad", "poznan", "presidenteprudente", "pto.penasco", "pagopago", "petropavlovsk", "phaplu", "popayán", "brandycreek", "puertoprincesa", "papeete", "portprotection", "kiengiang", "presqueisle", "portmacquarie", "pilotstation", "prescott", "prague6", "praslinisland", "prishtina", "pisa", "pasco", "cotolaurel", "petersburg", "chachagüí", "palmsprings", "pescara", "posadas", "puertosuárez", "portalsworth", "malololailai", "pietersburg", "portheiden", "lesabymes", "platinum", "tocumen", "pueblo", "lescar", "salvaleóndehigüey", "pukarua", "puntaarenas", "busan", "puertoasís", "pullman", "pluj", "sanandrés", "provincetown", "warwick", "huinan", "pôrtovelho", "paliambela", "puertovallarta", "anadyr'", "wheeling", "portland", "pavlodar", "sanpedrojuchatengo", "portosanto", "gialai", "maroa", "polyarnyj", "pietermaritzburg", "penzance", "panzhihua", "ciudadguayana", "portsudan", "masset", "ashford", "dusseldorf", "freiburg", "sarrebruck", "jejusi", "nantes", "cologne", "owerri", "dover", "harwich", "london", "manchester", "birmingham", "london", "britrailrailzones", "london", "london", "bath", "york", "rotterdam", "queretaro", "warri", "setif", "qulin", "saojosedospinhais", "aixlesmilles", "angers", "gefle", "uppsala", "rabaul", "arar", "rafha", "praia", "rajkot", "marrakesh", "ribeirãoprêto", "rapidcity", "avarua", "rasht", "rabat", "brookslodge", "rurrenabaque", "riobranco", "ramata", "roundup", "ruby", "empangeni", "fridayharbor", "ríohacha", "redcliffe", "bellfield", "cinderriver", "reddog", "redding", "redmond", "redang", "raleighdurham", "reddevil", "marcillac", "reao", "recife", "reggiodicalabria", "trelew", "orenburg", "siemrap", "makallé", "reus", "reynosa", "rockford", "papeete", "ríogrande", "papeete", "ríogallegos", "insein", "rhinelander", "rodhos", "santamaria", "riberalta", "richmond", "riogrande", "rishirifujicho", "alessandro", "riverton", "marupe", "shuhayr", "kapavaram", "rijeka", "logrono", "rafsanjan", "owlshead", "rocksprings", "", "reykjavik", "rostocklaage", "blythdale", "marsaalam", "rimini", "rampart", "taichung", "tatawin", "arona", "kallinge", "rennell", "ronne", "reno", "rongelapisland", "stjacques", "roanoke", "harbelville", "rochester", "roiet", "rockhampton", "rondonópolis", "rota", "koror", "rosario", "rotorua", "taganrog", "roswell", "banarsi", "rodriguesis", "roros", "santarosa", "rocksound", "russianmission", "olga", "rochester", "yeosusi", "fortmyers", "rotumaisland", "roatán", "ruteng", "rotterdam", "saratov", "arua", "oslo", "riyadh", "rukumkot", "rumjatar", "saintemarie", "rurutu", "northclarendon", "farafangana", "saravena", "rorvik", "saarenkylä", "ravensthorpe", "rairua", "ivisan", "rygge", "rahimyarkhan", "trzebownisko", "taytaysandoval", "ramsar", "sawan", "", "arraudha", "sanluis", "sandiego", "sanpedrosula", "sanandros", "sanantonio", "savannah", "umraniye", "goleta", "gustavia", "santaana", "southbend", "sanluisobispo", "saibaiisland", "sibu", "salisbury", "sibiu", "prudhoebay", "statecollege", "stockton", "loamor", "scammonbay", "sarrebruck", "aktau", "santiago", "socotra", "", "", "syktyvkar", "salinacruz", "puertobaquerizomoreno", "santacruzis", "lubango", "frías", "louisville", "sanandaj", "natorishi", "sandakan", "bergeforsen", "sandene", "sandpoint", "santodomingo", "santander", "saidu", "riodejaneiro", "telavivyafo", "sidney", "seattle", "sabha", "southendonsea", "siwa", "victoria", "safaqis", "sanford", "sanfernandodeapure", "sanfernando", "", "kangerlussuaq", "saofilipe", "santafe", "sanfrancisco", "skelleftea", "khantymansiysk", "sonderborg", "springfield", "hochiminhcity", "stgeorge", "st.george", "songea", "skagway", "shanghai", "nakashibetsucho", "indaselassie", "weyerscave", "shenyang", "shungnak", "shishmaref", "ajman", "shillong", "shirahamacho", "qinhuangdao", "sheridan", "shreveport", "assaraura", "shageluk", "shinyanga", "xi'an", "sinop", "santamaria", "simara", "sanjuan", "singapore", "simferopol'", "sitka", "sanjose", "s.josedelcabo", "sanjosedelguavuare", "sanjose", "ilidža", "saojosedoscampos", "heredia", "sãojosédorioprêto", "sanangelo", "carolina", "shijiazhuang", "seinajoki", "velas", "basseterre", "suki", "samarkand", "skien", "thessaloniki", "surkhet", "shaktoolik", "stokkmarknes", "shunni", "skopje", "sialkot", "skiros", "sukkur", "lacaldera", "saltlakecity", "salem", "sola", "solwezi", "saranaclake", "salalah", "villagonzalodetormes", "salina", "s.luispotosi", "sleetmute", "stlucia", "jutogh", "generalcepeda", "saltcay", "salekhard", "salvador", "viladoporto", "sacramento", "pithagorion", "stmichael", "simms", "salmon", "", "toamasina", "santamaria", "santaana", "salinas", "ribeirabrava", "shannonairport", "sakonnakhon", "saintpaulisland", "montoirdebretagne", "esperanza", "thandwe", "zalavár", "surakarta", "sofia", "kaupanger", "sørkjosen", "cantaura", "", "soderhamn", "sorong", "southampton", "seldovia", "showlow", "charlotteamalie", "breñaalta", "dinajpur", "springfield", "viladoporto", "saipan", "menongue", "sanpedro", "wichitafalls", "split", "storuman", "santarosa", "sucre", "semarang", "sanborja", "skjold", "sarasota", "stonyriver", "sert", "sary", "santacruzdelasierra", "salvador", "christiansted", "malabo", "alarish", "sandnessjoen", "sara", "m'banzacongo", "st.cloud", "santaanadeltachira", "stgeorgeisland", "lalomota", "st.louis", "santarém", "stanstedmountfitchet", "stuttgart", "windsor", "charlotteamalie", "un", "stavropol'", "frederiksted", "sidoarjo", "casecervi", "surigaocity", "satumare", "hailey", "summerbeaver", "nausori", "siouxcity", "savoonga", "sambava", "silvercity", "kingstown", "rage", "sanvicentedelcaguán", "svolvar", "savonlinna", "zelenograd", "seville", "stevensvillage", "labasa", "yekaterinburg", "táriba", "chenghai", "newwindsor", "southwestbay", "trezzanosulnaviglio", "stillwater", "sumbawabesar", "swansea", "entzheim", "schönefeld", "larass", "", "sheldonpoint", "srinagar", "kodiak", "sydney", "sirjan", "simao", "shonai", "syracuse", "sueisland", "sanya", "isleoflewis", "shiraz", "santoantóniodozaire", "kampongbarusubang", "sheffield", "samsun", "salzburg", "suzhou", "shenzhen", "goleniów", "plymouth", "taclobancity", "daegu", "tagbilarancity", "isangel", "alganad", "takamatsu", "tanana", "tampico", "wanggezhuang", "tapachula", "tashkent", "poprad", "tuyhoa", "tabubil", "alcantara", "newbight", "jundobah", "fortleonardwood", "tabora", "tumbes", "tbilisi", "nuku'alofa", "tambov", "tabriz", "greenturtlecay", "tulcea", "tchibanga", "tumaco", "taba", "tacna", "tuticorin", "takotna", "trinidad", "trat", "teterboro", "tebessa", "valdez", "tongren", "praiadavitória", "tete", "telluride", "tufi", "tegueste", "granadilla", "milan", "podgorica", "kualaterengganu", "", "tiga", "", "tongliao", "ouargla", "tegucigalpa", "sanfernando", "teresina", "berlin", "tachilek", "trollhatan", "thorshofn", "tehran", "sawankhalok", "pituffik", "krna", "", "tikehauatoll", "tijuana", "nabire", "tindouf", "tripoli", "tinian", "renigunta", "kubinvillage", "timaru", "teodo", "mendi", "tarija", "tyumen'", "takume", "tanjungpandan", "tenakeesprings", "tanjungkarang", "tok", "weno", "amagicho", "takapoto", "kigoma", "matsushigecho", "turku", "tatakoto", "takaroa", "teller", "tolucadelerdo", "toliara", "tallahassee", "tatalina", "tallinn", "tlemcen", "hyeres", "blagnac", "tuluksak", "petaẖtiqwa", "tambolaka", "tame", "termiz", "savelugu", "toamasina", "pitkäniemi", "tamanrasset", "saotome", "trombetas", "lepanto", "barry", "timimoun", "jinan", "tincity", "tangiers", "tanjungpinang", "tununak", "tainancity", "liberia", "ambohidratrimo", "tosontsengel", "kampunggenting", "tawzar", "tomsk", "togiakvillage", "torres", "swanton", "", "tromso", "touho", "toyamashi", "tampa", "taoyuancity", "taplejung", "tarapoto", "tepic", "trapani", "sandominoisland", "torreón", "stjordal", "crossapol", "sandefjord", "tauranga", "blountville", "tarakan", "caselle", "taree", "ronchi", "huanchaco", "thiruvananthapuram", "tarawa", "tiruchirapally", "taipeicity", "aqmola", "treviso", "tsushimashi", "ciudadvalles", "tanggu", "islesofscilly", "", "newyork", "muangtrang", "townsville", "tantan", "ternate", "tottorishi", "colorado", "taitungcity", "tetouan", "urbina", "tubuai", "bandadelríosalí", "tambacounda", "tours", "tuguegarao", "turayf", "turbat", "tulsa", "tunis", "taupo", "tupelo", "tucuruí", "tucson", "tabuk", "traversecity", "thiefriverfalls", "taveuni", "dawe", "twinhills", "toowoomba", "twinfalls", "tawitawi", "tawau", "texarkana", "berlin", "haiyang", "torsby", "taiyuan", "tyler", "knoxville", "hattieville", "mangrovecay", "trabzon", "uahuka", "narsarssurk", "uapou", "9dejulio", "samburu", "uberaba", "ubeshi", "donmotdaeng", "ukhta", "uberlandia", "uzhhorod", "debari", "quelimane", "kumejimacho", "", "oufa", "pilotpoint", "urgench", "kodiak", "quibdó", "quinhon", "utila", "quincy", "quito", "plomelin", "kobeshi", "ustkamenogorsk", "portvato", "ulanbator", "ulaangom", "quilpie", "gulu", "dimitrovgrad", "uummannaq", "umea", "kiunga", "unalakleet", "ranong", "havana", "maros", "oral", "urumqi", "kingissepa", "uruguaiana", "uraj", "stpierre", "kursk", "phunphin", "gurayat", "ushuaia", "usinsk", "kosamui", "ulsan", "usak", "coron", "changwatudonthani;udonthani", "upington", "banchang", "umtata", "kabansk", "baruunurt", "kholmsk", "fayaoué", "vieuxfort", "wiesbaden", "nyala", "yulin", "vaasa", "vanimo", "hooperbay", "van", "suavanao", "varna", "sivas", "neiafu", "vardo", "bluemountain", "verona", "vanuabalavu", "visby", "venice", "tamky", "campinas", "condao", "victoria", "victorville", "ovda", "fagernes", "vitóriadaconquista", "valverde", "viedma", "vadso", "valdez", "venetie", "vernal", "teocelo", "vestmannaeyjar", "", "manthena", "vigo", "villagarzon", "saurimo", "vilhelmina", "vahitahi", "kleinneusiedl", "elvigia", "vinhcity", "virgingorda", "addakhla", "visalia", "vitoria", "vitoria", "kiengiang", "podol'sk", "ukhta", "manises", "valdosta", "portvila", "valladolid", "valencia", "valesdir", "siquisique", "anglesey", "vilnius", "baragaon", "vilanculos", "kamyshin", "almiros", "semiluki", "ongiva", "egilsstadir", "eglinvillage", "chimoio", "puertoferro", "varadero", "virac", "varkaus", "sommacampagna", "varoy", "villahermosa", "luhans'k", "vasteras", "vientiane", "becerra", "visakhapatnam", "valledupar", "villavicencio", "santacruz", "nakhodka", "illizi", "lichinga", "mindelo", "vaxjo", "wales", "wadiaddawasir", "wanganui", "antsalova", "waterford", "warsaw", "stebbins", "beaver", "", "weifang", "weihai", "weipa", "foresthill", "walgett", "waingapu", "wadihalfa", "whakatane", "wick", "nairobi", "corfield", "woja", "wonju", "wanaka", "wakkanaishi", "aleknagik", "wellington", "walaha", "selawik", "wallisisland", "meyerschuck", "maroantsetra", "whitemountain", "mananara", "napakiak", "casummitlake", "pili", "tanbar", "nawabshah", "wenzhou", "wipim", "whangarei", "wrangell", "worland", "wroclaw", "southnaknek", "westerly", "westsound", "westport", "noatak", "tuntutuliak", "tsiroanomandidy", "wuhai", "wuhan", "wiluna", "wuyishan", "wuxi", "walvisbay", "wewak", "whalepass", "newtok", "wanxian", "whyalla", "westyellowstone", "oromedonte", "chapeco", "capreol", "dorval", "cambellton", "casummitlake", "birjand", "brockville", "thesettlement", "oromedonte", "chatham", "coole", "lille", "", "halifax", "", "drummondville", "moncton", "london", "oromedonte", "", "princegeorge", "princerupert", "sarina", "sudbury", "thepas", "vancouver", "windsor", "paris", "lacedouard", "winnipeg", "kingston", "ladysmith", "melville", "newcarlisle", "strasbourg", "london", "stockholm", "sodertalje", "stratford", "parent", "perce", "eskilstuna", "senneterre", "shawinigan", "cowichanvalley", "xiangfan", "malmo", "weymont", "malmo", "alexandria", "tierp", "brantford", "hamburg", "quebec", "charny", "lund", "cobourg", "coteau", "grantham", "chisasibi", "grimsby", "aixlachapelle", "valence", "georgetown", "liege", "chemainus", "guelph", "ingersoll", "xichang", "maxville", "napanee", "xilinhot", "sainthyacinthe", "stmarys", "woodstock", "london", "xianyang", "joliette", "jonquiere", "xiengkhouang", "kualalumpur", "casummitlake", "sackville", "lacbrochet", "quebec", "montreal", "guildwood", "", "niagarafalls", "aldershot", "truro", "manihi", "xiamen", "zúñac", "yamisland", "bentonville", "santoantôniodoiçá", "nottingham", "xining", "northallerton", "nuneaton", "newyork", "oakville", "poitiers", "parksville", "penrith", "paris", "montpellier", "brampton", "portklang", "preston", "pointeauxtrembles", "london", "berwick", "nottingham", "lancaster", "quepos", "qualicumbeach", "runcorn", "marseille", "pineridge", "rugby", "jerez", "cockburnharbour", "tours", "nelsonhouse", "singapore", "salisbury", "thargomindah", "thirsk", "nelsonhouse", "strathroy", "xuzhou", "stockport", "stafford", "crewe", "longville", "peterborough", "stevenage", "durham", "belleville", "belleville", "wakefieldwestgate", "strokeontrent", "karlskrona", "gothenburg", "hallsberg", "warrington", "hassleholm", "enkoping", "orebro", "swindon", "varberg", "wyoming", "nykoping", "alvesta", "degerfors", "katrineholm", "mjolby", "riyadh", "leksand", "valbonne", "hedemora", "sundsvall", "yandina", "borlänge", "herrljunga", "lyon", "falkoping", "helsingborg", "flen", "norrkoping", "kristinehamn", "avestakrylbo", "angelholmhelsingborg", "sala", "arvika", "harnosand", "casselman", "glencoe", "rail(generic)", "edmonton", "macau", "avignon", "oslo", "rail(generic)", "toulon", "alexiscreek", "casummitlake", "fortfrances", "yakutat", "saultste.marie", "yaounde", "colonia", "winisk", "casummitlake", "st.anthony", "lakecowichan", "cambridgebay", "betsiamites", "saguenay", "st.anthony", "chesterfieldinlet", "goldriver", "yibin", "killarney", "brochet", "nelsonhouse", "bedwellharbor", "havrestpierre", "toronto", "courtenay", "cambridgebay", "moosecreek", "nanaimo", "castlegar", "hayriver", "fonthill", "cambridgebay", "nelsonhouse", "chesterfieldinlet", "chesterfieldinlet", "iqaluit", "dawson", "st.anthony", "dauphin", "happyvalleygoosebay", "dawsoncreek", "leduc", "bursa", "chesterfieldinlet", "casummitlake", "yasouj", "hayriver", "winisk", "iqaluit", "fredericton", "marathon", "snarelake", "flinflon", "hayriver", "st.anthony", "gibsons", "saltspringisland", "hayriver", "sakaiminatoshi", "kingston", "chisasibi", "nelsonhouse", "gaspé", "fatima", "iqaluit", "havrestpierre", "chisasibi", "nelsonhouse", "iqaluit", "st.anthony", "melfort", "dryden", "st.anthony", "holman", "cambridgebay", "beamsville", "happyvalleygoosebay", "casummitlake", "havrestpierre", "gibsons", "sthubert", "hayriver", "fallriver", "havrestpierre", "yichang", "chisasibi", "yining", "iqaluit", "ypsilanti", "nelsonhouse", "yiwu", "stephenville", "kamloops", "kitchener", "chisasibi", "chisasibi", "yakima", "chisasibi", "yakutsk", "masset", "chisasibi", "iqaluit", "hayriver", "marathon", "vegreville", "latuque", "kelowna", "st.anthony", "fortchipewyan", "happyvalleygoosebay", "winisk", "métabetchouan", "mirabel", "montreal", "havrestpierre", "yanbualbahr", "chisasibi", "gatineau", "nelsonhouse", "vienna", "yanji", "casummitlake", "natuashish", "chisasibi", "yantai", "sonyangmyeon", "yancheng", "dawson", "marathon", "nelsonhouse", "brownvale", "oshawa", "brownvale", "ottawa", "lakecowichan", "hayriver", "brownvale", "chisasibi", "chisasibi", "casummitlake", "casummitlake", "winisk", "princerupert", "powellriver", "chisasibi", "smithers", "stefoy", "chisasibi", "thepas", "sylvanlake", "windsor", "kenora", "pincher", "moncton", "marathon", "comox", "regina", "thunderbay", "brownvale", "gander", "sydney", "quesnel", "hayriver", "iqaluit", "st.anthony", "happyvalleygoosebay", "roberval", "casummitlake", "nelsonhouse", "chesterfieldinlet", "garson", "hayriver", "smithsfalls", "st.john", "iqaluit", "hayriver", "happyvalleygoosebay", "iqaluit", "meiktila", "hayriver", "nelsonhouse", "iqaluit", "alma", "nelsonhouse", "casummitlake", "monttremblant", "chisasibi", "southporcupine", "toronto", "hayriver", "chisasibi", "dorval", "yuma", "chesterfieldinlet", "iqaluit", "évain", "moroni", "percé", "iqaluit", "vald'or", "chisasibi", "hayriver", "richmond", "casummitlake", "chisasibi", "winnipeg", "hayriver", "hayriver", "wabush", "williamslake", "st.anthony", "marathon", "gibsons", "cranbrook", "saskatoon", "medicinehat", "fortst.john", "rimouski", "siouxlookout", "chesterfieldinlet", "iqaluit", "princegeorge", "terrace", "london", "abbotsford", "whitehorse", "northbay", "calgary", "smithers", "fortnelson", "penticton", "charlottetown", "cambridgebay", "sidney", "nelsonhouse", "nelsonhouse", "happyvalleygoosebay", "st.john's", "kapuskasing", "montjoli", "mississauga", "yellowknife", "chisasibi", "masset", "sarnia", "chesterfieldinlet", "gibsons", "septîles", "trail", "nelsonhouse", "zadar", "nagygoricza", "dowzdab", "pelchuquin", "zamboanga", "nuremberg", "zhaotong", "zaragoza", "basel", "bathurst", "biloela", "baltimore", "chabahar", "", "pánuco", "padrelascasas", "basel", "sydney", "london", "kelsey", "zei", "", "masset", "chisasibi", "london", "zeu", "chesterfield", "rennes", "hayriver", "hayriver", "bordeaux", "philadelphia", "buffalo", "groton", "glasgow", "copenhagen", "nelsonhouse", "zhongshan", "gotha", "havrestpierre", "gaua", "zhanjiang", "houston", "ottawa", "ziguinchor", "petatlán", "inverness", "tanjungpelepas", "winisk", "havrestpierre", "lemans", "manzanillo", "london", "havrestpierre", "albany", "hamburg", "newark", "milwaukee", "masset", "munich", "huangpu", "nanaimo", "santoantôniodoiçá", "newman", "santaelenadeuairén", "stonetown", "osorno", "casummitlake", "queenstown", "zweibrucken", "frankfurt", "richmond", "kloten", "casummitlake", "lancaster", "newark", "hartford", "boston", "providence", "cockburntown", "stpierredelareunion", "springfield", "casummitlake", "southindianlake", "tureira", "havrestpierre", "schenectady", "rochester", "stamford", "zante", "humen", "princeton", "nelsonhouse", "philadelphia", "boston", "louisville", "boston", "utica", "harrisburg", "zhuhai", "wabush", "zuni", "newhaven", "savannakhet", "hanover", "hampton", "", "wilmington", "stuttgart", "washington", "glenview", "hampton", "aberdeen", "edinburgh", "amsterdam", "shekou", "sylhet", "nimes", "newyork", "syracuse", "brussels", "antwerp", "tenienter.marsh"],
//     function (location) {
//         if (location.length > 0)
//             hashtagCount[location] = 0;
//     });

// var lineReader = require('readline').createInterface({
//     input: require('fs').createReadStream('usernames.txt')
// });
//
// lineReader.on('end', function () {
//     console.log("End");
//     console.log(hashtagCount);
// });
//
// var promise = Promise.resolve();
// lineReader.on('line', function (line) {
//     line = line.toLowerCase().trim();
//     if (line.match(/[a-z_]+/gi)) {
//
//         promise = promise.then(function () {
//             return getHashtags(line);
//         });
//     }
// });

function getHashtags(id) {

    return new Promise(function (resolve, reject) {
        // console.log("id " + id + "id");
        try {
            https.get({
                hostname: 'www.instagram.com',
                port: 443,
                headers: {"Accept-Encoding": "gzip, deflate, br"},
                method: "GET",
                path: '/' + id + '/',
                agent: false
            }, function (res) {

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    if (res.statusCode !== 404) {
                        console.log(index + " not success " + res.statusCode + " ");
                    }
                    reject();
                }
                var body = [];
                res.on('data', function (chunk) {
                    body.push(chunk);
                });

                // resolve on end
                res.on('end', function () {
                    try {
                        var compressed = new Uint8Array(Buffer.concat(body));
                        var result;
                        try {
                            result = pako.inflate(compressed, {to: 'string'});
                        } catch (err) {
                            reject(err);
                        }

                        // console.log(result.indexOf("window._sharedData ="));
                        result = result.substring(result.indexOf("window._sharedData =") + 21);
                        result = result.substring(0, result.indexOf("</script>") - 1);
                        var data = JSON.parse(result);

                        var tags = {};

                        _.each(data.entry_data.ProfilePage[0].user.media.nodes, function (node) {
                            if (node.caption)
                                _.each(node.caption.match(/#[a-z]+/gi), function (tag) {
                                    if (tags[tag])
                                        tags[tag]++;
                                    else
                                        tags[tag] = 1;

                                });
                        }, function (err) {
                            reject(err);
                        });
                        resolve(tags);

                    } catch (e) {
                        reject(e);
                    }
                })
            });
        } catch (err) {
            // console.log(id + " is skipped " + err);
            resolve();
        }
    });


}

function delay(t) {
    return new Promise(function(resolve) {
        setTimeout(resolve, t)
    });
}


module.exports = app;
