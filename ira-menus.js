'use strict';

// const path = require('path');
// const fs = require('fs');
// const express = require('express');
// //const config = require('./prop3config');
// const app = express();
// const bodyParser = require('body-parser');
// const urlencodedParser = bodyParser.urlencoded({ extended: false })

// //all the auth stuff
 const flash             = require('connect-flash-plus');
// const crypto            = require('crypto');
// const passport          = require('passport');
// const LocalStrategy     = require('passport-local').Strategy;
//
// const cookieParser = require('cookie-parser')
// const session = require('express-session')
// const RedisStore = require('connect-redis')(session)
// //const bcrypt = require('bcrypt');
//
const iraSQL =  require('./ira-model');
const app = require('./ira');
// const secret = "cat"
// const iraVersion = "0.9.3 +investor portfolio+parse commas"
// const nodePort = 8081
// //var router = express.Router();  then call router.post('/')
//
//
//   app.set('trust proxy', true);
  app.use(flash());
  app.use(cookieParser(secret));
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json());
//
//   app.use(session({
//       cookieName: 'irasess',
//       secret: secret,
//       resave: true,
//       //store: RedisStore,
//       saveUninitialized: true,
//       cookie : { httpOnly: true, expires: 60*60*1000 }
//   }));
//   app.use(passport.initialize());
//   app.use(passport.session());
// //app.use(passport.authenticate('session'));
// //props.use(app.router);






// app.set('view engine', 'hbs');
// app.set('views', path.join(__dirname, '/views/'));
// app.use('/static', express.static(__dirname + '/static'));
//
// let sessioninfo = "no session"
let userObj =
{
  "id":0,
  "firstname":"Log In",
  "lastname":"",
  "email":"",
  "password":"",
  "photo":"https://raw.githubusercontent.com/wilsonvargas/ButtonCirclePlugin/master/images/icon/icon.png",
  "access":0
}


//============ FUNCTIONS ======================


module.exports = function(app){


app.get('/entities', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getAllEntities().then(
                function(entities) {
                          //console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
                          var expandEntities = entities;

                          for (let index = 0; index < entities.length; index++) {
                                 if(  (expandEntities[index].ownership===0) && (expandEntities[index].type === 1)    ) {
                                            expandEntities[index].canSetOwnership = true
                                 //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
                               } //
                          }//for


                          res.render('list-entities', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" entities.",
                                  entities: expandEntities
                          });//render


                }, function(err) {   //failed
                               console.log("List entities problem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
}); //  entities route


app.get('/investors', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getEntitiesByTypes([2,4]).then(
                function(entities) {
                          res.render('list-investors', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" investors.",
                                  entities: entities
                          });//render


                }, function(err) {   //failed
                               console.log("List investors problem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
}); //  entities route





app.get('/deals', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getEntitiesByTypes([1]).then(
                function(entities) {
                          //console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
                          var expandEntities = entities;

                          for (let index = 0; index < entities.length; index++) {
                                 if(  (expandEntities[index].ownership===0) && (expandEntities[index].type === 1)    ) {
                                            expandEntities[index].canSetOwnership = true
                                 //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
                               } //
                          }//for


                          res.render('list-deals', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" deals.",
                                  entities: expandEntities
                          });//render


                }, function(err) {   //failed
                               console.log("List deals problem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
}); //  entities route







//this is the list page of all possible ownership deals
app.get('/setownership', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getEntitiesByOwnership(0).then(
                function(entities) {
                          //console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
                          var expandEntities = entities;

                          for (let index = 0; index < entities.length; index++) {
                                 if(  (expandEntities[index].ownership===0) && (expandEntities[index].type === 1)    ) {
                                            expandEntities[index].canSetOwnership = true
                                 //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
                               } //
                          }//for


                          res.render('setown-entities', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" entities.",
                                  entities: expandEntities
                          });//render


                }, function(err) {   //failed
                               console.log("List entities problem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
}); //  entities route




app.get('/transactions', (req, res) => {
  if (req.session && req.session.passport) {
     userObj = req.session.passport.user;

   }
          iraSQL.getAllTransactions().then(
                function(transactions) {
                          res.render('list-transactions', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "  Showing "+transactions.length+" transactions",
                                  transactions: transactions
                          });//render

                }, function(err) {   //failed
                               console.log("Ledger problem: "+err);
                               return;
                } //  success function
          ); //getAll Trandactions then
}); //  /entities route









  app.get('/home', (req, res) => {

    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }


      let reportMenuOptions = []
      reportMenuOptions[0] = {name:"Investors", link:"/investors"}
      reportMenuOptions[1] = {name:"Deals", link:"/deals"}
      reportMenuOptions[2] = {name:"All Transactions", link:"/transactions"}
      reportMenuOptions[3] = {name:"All Entities", link:"/entities"}


      let adminMenuOptions = []
      adminMenuOptions[0] = {name:"New Transaction", link:"/add-transaction"}
      adminMenuOptions[1] = {name:"New Deal", link:"/add-deal"}
      adminMenuOptions[2] = {name:"New Entity", link:"/add-entity"}
      adminMenuOptions[3] = {name:"Set Ownership", link:"/setownership/"}



      res.render('home', {
              userObj: userObj,
              message: req.flash('login'),
              reportmenuoptions: reportMenuOptions,
              adminmenuoptions: adminMenuOptions,
              iraVersion: iraVersion
      });

  });


  app.get('/', function(req, res) {
        res.redirect('/home')

 })

}
