var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport')
var InstagramStrategy = require('passport-instagram').Strategy
var session = require('express-session')
var MongoStore = require('connect-mongo')(session)
var User = require("./models/user");

//Configure Github Strategy
passport.use(new InstagramStrategy({
  clientID: "bc8daff6d1df46f1a38cf0e6d523574f",
  clientSecret:"66153aeed11a45a18e849866f0676e20",
  callbackURL: "http://localhost:3000/auth/instagram/return"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ instagramId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
))

//user is mongoose model in our case
//null for the error
passport.serializeUser(function(user, done){
  done(null, user._id)
})

passport.deserializeUser(function(userId, done){
  User.findById(userId, done)
})


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
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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

//pass session options to session middleware
app.use(session(sessionOptions))

//initialize passport
app.use(passport.initialize())

//Restore session
app.use(passport.session())

// mongo error
db.on('error', console.error.bind(console, 'connection error:'));

app.use('/', routes);
app.use('/auth', auth);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
