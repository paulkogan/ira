'use strict';

const flash   = require('connect-flash-plus');
const session = require('express-session')
let sessioninfo = "no session"
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

//const app = express();
const express = require('express');
var router = express.Router();
const iraSQL =  require('./ira-model');
const ira =  require('./ira');
const secret = "cat"

router.use(flash());
router.use(session({
  cookieName: 'irasess',
  secret: secret,
  resave: true,
  //store: RedisStore,
  saveUninitialized: true,
  cookie : { httpOnly: true, expires: 60*60*1000 }
}));
// router.use(passport.initialize());
// router.use(passport.session());
// router.use(passport.authenticate('session'));




//============ FUNCTIONS ======================

module.exports = router;


//list for ownerships to set
  router.get('/setownership', (req, res) => {
            if (req.session && req.session.passport) {
               userObj = req.session.passport.user;

             }
            iraSQL.getEntitiesByTypes([1,3,4]).then(
                  function(entities) {
                            //console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
                            var expandEntities = entities;

                            for (let index = 0; index < entities.length; index++) {
                                   if(  (expandEntities[index].ownership===0) && (expandEntities[index].type === 1)    ) {
                                              expandEntities[index].canSetOwnership = true
                                   //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
                                 } //
                            }//for

                            //console.log("\nEntities for Manage Owenership menu "+JSON.stringify(entities,null,4));
                            res.render('setown-entities', {
                                    userObj: userObj,
                                    sessioninfo: JSON.stringify(req.session),
                                    message: req.flash('login') + "Showing "+entities.length+" entities.",
                                    //message: "Showing "+entities.length+" entities.",
                                    entities: expandEntities
                            });//render


                  }, function(err) {   //failed
                                 console.log("List entities problem: "+err);
                                 return;
                  } //  success function
            ); //getAll Entities then
  }); // setownership route



router.get('/entities', (req, res) => {
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


router.get('/investors', (req, res) => {
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





router.get('/deals', (req, res) => {
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


router.get('/transactions', (req, res) => {
   res.redirect('/transactions/000');
});







router.get('/commitments', (req, res) => {
  if (req.session && req.session.passport) {
     userObj = req.session.passport.user;

   }
          iraSQL.getTransactionsByType(2).then(
                function(transactions) {
                          res.render('list-commitments', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "  Showing "+transactions.length+" transactions",
                                  transactions: transactions
                          });//render

                }, function(err) {   //failed
                               console.log("commitments problem: "+err);
                               return;
                } //  success function
          ); //getAll Trandactions then
}); //  /entities route


  router.get('/home', (req, res) => {

    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }


      let reportMenuOptions = []
      reportMenuOptions[0] = {name:"Investors", link:"/investors"}
      reportMenuOptions[1] = {name:"Deals", link:"/deals"}
      //reportMenuOptions[2] = {name:"Commitments", link:"/commitments"}
      reportMenuOptions[2] = {name:"All Transactions", link:"/transactions"}
      reportMenuOptions[3] = {name:"All Entities", link:"/entities"}


      let adminMenuOptions = []
      adminMenuOptions[0] = {name:"Manage Ownership", link:"/setownership/"}
      adminMenuOptions[1] = {name:"New Transaction", link:"/add-transaction"}
      adminMenuOptions[2] = {name:"New Entity", link:"/add-entity"}
      adminMenuOptions[3] = {name:"New Deal", link:"/add-deal"}



      res.render('home', {
              userObj: userObj,
              message: req.flash('login'),
              reportmenuoptions: reportMenuOptions,
              adminmenuoptions: adminMenuOptions,
              iraVersion: ira.version
      });

  });


  router.get('/', function(req, res) {
        res.redirect('/home')

 })
