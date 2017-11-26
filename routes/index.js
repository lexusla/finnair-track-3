var express = require('express');
var router = express.Router();

/* GET home page */
router.get('/', function(req, res) {
  res.render('index', { title: 'Home', user: req.user });
});

/* GET about page */
router.get('/about', function(req, res) {
  res.render('about', { title: 'About', user: req.user });
});

/* GET contact page */
router.get('/flight', function(req, res) {
  res.render('flight', { title: 'Flights', user: req.user });
});

/* GET contact page */
router.get('/profile', function(req, res) {
    res.render('profile', { title: 'Profile', user: req.user });
});

/* GET login page */
router.get('/login', function(req, res) {
  res.render('login', { title: 'Log In', user: req.user });
});

module.exports = router;
