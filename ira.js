'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
//const config = require('./prop3config');
const app = express();
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })

//all the auth stuff
const flash             = require('connect-flash-plus');
const crypto            = require('crypto');
const passport          = require('passport');
const LocalStrategy     = require('passport-local').Strategy;

const cookieParser = require('cookie-parser')
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
//const bcrypt = require('bcrypt');

const iraSQL =  require('./ira-model');
const secret = "cat"
const iraVersion = "0.7 +set ownership"
const nodePort = 8081
//var router = express.Router();  then call router.post('/')


  app.set('trust proxy', true);
  app.use(flash());
  app.use(cookieParser(secret));
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json());

  app.use(session({
      cookieName: 'irasess',
      secret: secret,
      resave: true,
      //store: RedisStore,
      saveUninitialized: true,
      cookie : { httpOnly: true, expires: 60*60*1000 }
  }));
  app.use(passport.initialize());
  app.use(passport.session());
//app.use(passport.authenticate('session'));
//props.use(app.router);



const hbs = require('hbs');
hbs.registerHelper('ifEqual', function(v1, v2, options) {
          if(v1 === v2) {
              return options.fn(this);
          }
          return options.inverse(this);

});

hbs.registerHelper('ifLessThan', function(v1, v2, options) {
          if(v1 < v2) {
              return options.fn(this);
          }
          return options.inverse(this);

});

hbs.registerHelper('ifGreaterThan', function(v1, v2, options) {
          if(v1 > v2) {
              return options.fn(this);
          }
          return options.inverse(this);

});


app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '/views/'));
app.use('/static', express.static(__dirname + '/static'));

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


//============ FUNCTIONS ======================

function formatCurrency (amount) {
     return "$"+amount.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
}


function totalupInvestors (investors) {
      let expandInvestors = investors
      let totalCapital = 0;
      let totalCapitalPct =0;
      for (let index = 0; index < investors.length; index++) {
             totalCapital += expandInvestors[index].amount;
             totalCapitalPct += expandInvestors[index].capital_pct;
             expandInvestors[index].formattedAmount = formatCurrency(expandInvestors[index].amount)
             //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
      }//for
      return [expandInvestors, formatCurrency(totalCapital), totalCapitalPct];
  } //function

  function calculateOwnership (transactionsFromEntity) {
        var ownershipRows = transactionsFromEntity
        var totalCapital = 0;

        for (let index = 0; index < ownershipRows.length; index++) {
               totalCapital += ownershipRows[index].amount;
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        console.log("In CalculateOwnership for "+ownershipRows[0].investment_name+"  total capital is: "+totalCapital)

        for (let index = 0; index < ownershipRows.length; index++) {
               ownershipRows[index].percent = (ownershipRows[index].amount/totalCapital)
               ownershipRows[index].formattedPercent = (ownershipRows[index].percent*100).toFixed(2)+"%"
               ownershipRows[index].formattedAmount = formatCurrency(ownershipRows[index].amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [ownershipRows, formatCurrency(totalCapital)];
    } //function


  function calculateDeal (deal) {
    console.log("in CalculateDeal, Deal is  "+JSON.stringify(deal));
        let expandDeal = deal
        expandDeal.total_value = formatCurrency(expandDeal.aggregate_value + expandDeal.cash_assets)
        expandDeal.total_debt = formatCurrency(expandDeal.aggregate_debt + expandDeal.deal_debt)
        expandDeal.aggregate_value = formatCurrency(expandDeal.aggregate_value)
        expandDeal.cash_assets = formatCurrency(expandDeal.cash_assets)
        expandDeal.aggregate_debt = formatCurrency(expandDeal.aggregate_debt)
        expandDeal.deal_debt  = formatCurrency(expandDeal.deal_debt)
        return expandDeal;
    } //function




//============ ROUTES  ======================

app.get('/ownership/:id', (req, res) => {
    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }

     showOwnershipInfo().catch(err => {
           console.log("ownership info problem: "+err);
           req.flash('login', "Problems getting Ownership "+req.params.id+".  ")
           res.redirect('/home')
     })

     async function showOwnershipInfo() {
           let foundEntity = await iraSQL.getEntityDetails(req.params.id);
           console.log("in OWN, have Entity   "+ JSON.stringify(foundEntity));
           if (foundEntity.ownership_status === 1) {
                          let investors = await iraSQL.getOwnershipForEntity(foundEntity.id);
                          let results = totalupInvestors(investors)
                          let expandInvestors = results[0]
                          let totalCapital =  results[1]
                          let totalCapitalPct = results[2]
                          console.log("rendering ownership")
                          res.render('deal-ownership', {
                                  userObj: userObj,
                                  message:  "Showing "+investors.length+" investors ",
                                  dealName: investors[0].investment_name,
                                  investors: expandInvestors,
                                  totalCapital: totalCapital,
                                  totalCapitalPct: totalCapitalPct
                          });

                    } else { //no ownership data
                          res.redirect('/setownership/'+req.params.id)

                } //if ownership
     } //async function
}); //route - ownership






app.get('/entities', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getAllEntities().then(
                function(entities) {
                          console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
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
                               console.log("List entitiesproblem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
}); //  entities route





app.get('/setownership/:id', (req, res) => {

    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }

    //call the async function
    pullOwnershipTransactions().catch(err => {
          console.log("SET ownership transactions problem: "+err);
    })

    async function pullOwnershipTransactions() {
          var entity = await iraSQL.getEntityDetails(req.params.id);
          console.log("in SET, have Entity   "+ JSON.stringify(entity));
          var rows = await iraSQL.getTransactionsForEntity(entity.deal_id);
          console.log("Got "+rows.length+" Transactions for   "+ entity.name+"  , look:  "+JSON.stringify(rows));
                  // screen transaction and calculate ownership
          if(entity.ownership_status===0 && (rows.length >0) ) {

                                var results = calculateOwnership(rows);
                                let ownershipRows = results[0]
                                let totalCapital =  results[1]
                                res.render('set-ownership', {
                                        userObj: userObj,
                                        message:  "Showing "+ownershipRows.length+" transactions",
                                        entityName: entity.name,
                                        investors: ownershipRows,
                                        totalCapital: totalCapital,
                                        postendpoint: '/process_set_ownership'

                                });
           } else {
            req.flash('login', "No ownership info or transactions found for "+entity.name);
            res.redirect('/home');

            // } else { //no transactions
            //                     res.render('set-ownership', {
            //                           userObj: userObj,
            //                           message:  "No relevant transactions found",
            //                           entityName: entity.name,
            //                           totalCapital: "$0.00"
            //                    }); //  render
      }  //if-else ownership status
   } //async function pullDealComponents
}); //route - deal details


// insert the new deal and corresponding entity
app.post('/process_set_ownership', urlencodedParser, (req, res) => {

  //call the async function
  insertOwnerhipAndUpdateEntity().catch(err => {
        console.log("New Ownership problem: "+err);
  })

  async function insertOwnerhipAndUpdateEntity() {
            let formDeal = req.body
            let newDeal = {
              name: formDeal.name,
              aggregate_value: formDeal.aggregate_value,
              cash_assets: formDeal.cash_assets,
              aggregate_debt: formDeal.aggregate_debt,
              deal_debt: formDeal.deal_debt,
              notes: formDeal.notes
            }

            var insertDealResults = await iraSQL.insertDeal(newDeal);
            console.log( "Added deal #: "+insertDealResults.insertId);
            req.flash('login', "Added Deal: "+insertDealResults.insertId);

            let dealEntity = {
              type:1,
              deal_id: insertDealResults.insertId,
              investor_id:null,
              keyman_id: null,
              name: newDeal.name,
              taxid: formDeal.taxid
            }
            var insertEntityResults = await iraSQL.insertEntity(dealEntity);
            req.flash('login', "In deals, added entity #: "+insertEntityResults.insertId);

            res.redirect('/entities');

   } //async function
}); //process add-deal route











  app.get('/add-deal', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;
          }

          res.render('add-deal', {
                  userObj: userObj,
                  postendpoint: '/process_add_deal'

          });//render

  }); //route



// insert the new deal and corresponding entity
app.post('/process_add_deal', urlencodedParser, (req, res) => {

  //call the async function
  insertDealAndEntity().catch(err => {
        console.log("Deal and Entity problem: "+err);
  })

  async function insertDealAndEntity() {
            let formDeal = req.body
            let newDeal = {
              name: formDeal.name,
              aggregate_value: formDeal.aggregate_value,
              cash_assets: formDeal.cash_assets,
              aggregate_debt: formDeal.aggregate_debt,
              deal_debt: formDeal.deal_debt,
              notes: formDeal.notes
            }

            var insertDealResults = await iraSQL.insertDeal(newDeal);
            console.log( "Added deal #: "+insertDealResults.insertId);
            req.flash('login', "Added Deal: "+insertDealResults.insertId);

            let dealEntity = {
              type:1,
              deal_id: insertDealResults.insertId,
              investor_id:null,
              keyman_id: null,
              name: newDeal.name,
              taxid: formDeal.taxid
            }
            var insertEntityResults = await iraSQL.insertEntity(dealEntity);
            req.flash('login', "In deals, added entity #: "+insertEntityResults.insertId);

            res.redirect('/entities');

   } //async function
}); //process add-deal route




app.get('/dealdetails/:id', (req, res) => {

    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }

    //call the async function
    pullDealComponents().catch(err => {
          console.log("Deal Components problem: "+err);
    })

    async function pullDealComponents() {
          var entity = await iraSQL.getEntityDetails(req.params.id);
          console.log("have Entity   "+ JSON.stringify(entity));
          var deals = await iraSQL.getDealDetails(entity.deal_id);
          console.log("Before Ownership, have Entity   "+ entity.name+"   and Deal is  "+JSON.stringify(deals));
          var investors = await iraSQL.getOwnershipForEntity(entity.id)
          if (investors.length>0) {
                                let results = totalupInvestors(investors)
                                let expandInvestors = results[0]
                                let totalCapital =  results[1]
                                let totalCapitalPct = results[2]
                                let expandDeal = calculateDeal(deals[0])
                                console.log("rendering ownership and Deal is "+JSON.stringify(deals))
                                res.render('deal-details', {
                                        userObj: userObj,
                                        message:  "Showing "+investors.length+" investors",
                                        dealName: expandDeal.name,
                                        investors: expandInvestors,
                                        totalCapital: totalCapital,
                                        totalCapitalPct: totalCapitalPct,
                                        deal:expandDeal
                                });

            } else { //no ownership data
                                let expandDeal = calculateDeal(deals[0])
                                res.render('deal-details', {
                                      userObj: userObj,
                                      message:  "No ownership information found ",
                                      dealName: expandDeal.name,
                                      deal:expandDeal
                                }); //  render
            }  //if-else  - no ownership get name of entity
      } //async function pullDealComponents
}); //route - deal details







app.get('/add-transaction', (req, res) => {
        if (req.session && req.session.passport) {
           userObj = req.session.passport.user;
        }

       //this is what we'll pass to the page to use in pulldowns
       let transactionTypesToPick = []
       let dealsToPick = []
       let passthrusToPick = []
       let investorsToPick = []

        iraSQL.getTransactionTypes().then(
              async function(transactiontypes) {
                        transactionTypesToPick = transactiontypes;
              }, function(error) {   //failed
                        console.log("Getting deals problem: "+error);
                        return;
              } //try-catch
           );


        //deals

        iraSQL.getEntitiesByTypes([1]).then(
              async function(entities) {
                       dealsToPick = entities;
              }, function(error) {   //failed
                       console.log("Getting deals problem: "+error);
                       return;
              } //try-catch
          );//getallEnties then

        //pass-thrus
        iraSQL.getEntitiesByTypes([3]).then(
              async function(entities) {
                      passthrusToPick = entities;
                  }, function(error) {   //failed
                       console.log("Getting passthrus problem: "+error);
                       return;
                } //try-catch
              )//getallEnties then


        // investor entities
        iraSQL.getEntitiesByTypes([4,2]).then(
              async function(entities) {
                    investorsToPick  = entities;
                    //console.log("rendering add-transaction");
                    res.render('add-transaction', {
                            userObj: userObj,
                            postendpoint: '/process_add_transaction',
                            typeOptions: transactionTypesToPick,
                            deals: dealsToPick,
                            investors: investorsToPick,
                            passthrus: passthrusToPick
                    });//render
              }, function(error) {   //failed
                    console.log("Getting entities problem: "+error);
                    return;
             } //try-catch
     )//getallEnties then

}); //route add transactions


// insert the new transaction
app.post('/process_add_transaction', urlencodedParser, (req, res) => {
    let transaction = req.body
    iraSQL.insertTransaction(transaction).then (
        function (savedData) {
            //console.log( "Added entity #: "+savedData.insertId);
            req.flash('login', "Added transaction no. "+savedData.insertId);
            res.redirect('/transactions');
          }, function(error) {   //failed
               console.log("Process_add_transaction problem: "+error);
               return;
          }

    ); //try-catch
}); //route



//route for add entity
  app.get('/add-entity', (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;
          }

          iraSQL.getEntityTypes().then(
                async function(entitytypes) {
                        res.render('add-entity', {
                                userObj: userObj,
                                postendpoint: '/process_add_entity',
                                typeOptions: entitytypes
                        });//render
                }, function(err) {   //failed
                               console.log("Getting Entity Types problem: "+err);
                               return;
                } //  success function
          ); //getAll Entity then
  }); //route



// insert the new entity
app.post('/process_add_entity', urlencodedParser, (req, res) => {
      let entity = req.body
      entity.deal_id = null;
      entity.investor_id = null;
      iraSQL.insertEntity(entity).then (
          function (savedData) {
              //console.log( "Added entity #: "+savedData.insertId);
              req.flash('login', "Added entity: "+savedData.insertId);
              res.redirect('/entities');
           }).catch(error => {
                 console.log("Process_add_entity problem: "+error);
                 return;

          }); //try-catch
}); //route



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


      let menuOptions = []
      menuOptions[0] = {name:"Entities", link:"/entities"}
      menuOptions[1] = {name:"Transactions", link:"/transactions"}
      menuOptions[2] = {name:"Add Deal", link:"/add-deal"}
      menuOptions[3] = {name:"Add Ledger Transaction", link:"/add-transaction"}
      menuOptions[4] = {name:"Add Entity", link:"/add-entity"}

      res.render('home', {
              userObj: userObj,
              message: req.flash('login'),
              menuoptions: menuOptions,
              iraVersion: iraVersion
      });

  });


  app.get('/', function(req, res) {
        res.redirect('/home')

 })


    // Start the server
    const server = app.listen(nodePort, function() {
      console.log('IRA listening on port  ' + nodePort);
    });


module.exports = app;



//======================   from PROPS  ==================


// props.get('/delete/:id', checkAuthentication, (req, res) => {
//   pModel.read (req.params.id, (err, entity) => {
//           //err comes back but not results
//           if (err) {
//             console.log("Props3: del request problem "+JSON.stringify(err));
//           }
//     res.render('delprop', {
//             title: 'Delete a Property',
//             property: entity,
//             deleteendpoint: '/process_delete'
//     });
//
//  }); //end modelRead
//
// });  //end DELETE request
//
//
//
//   // process delete
//   props.post('/process_delete', urlencodedParser, (req, res) => {
//         const data = req.body
//         //res.send("Just got: "+JSON.stringify(data)+"<br>")
//         if (data.del_response.toLowerCase() === "yes") {
//              pModel.delete (data.id, (err, results) => {
//                     //err comes back but not results
//                     if (err) {
//                       console.log("Props2: Delete problem "+JSON.stringify(err));
//                     } else { //deleted OK
//                     //res.send("Deleted Property ID "+data.id);
//                     req.flash('login', "Deleted Property "+data.id+".  ")
//                     res.redirect('/properties');
//                     }
//
//             });
//         } else  {
//               res.redirect('/properties');
//         }
//
//
// }); //===== END PROCESS DELETE


//     props.get('/updateuser/', checkAuthentication, (req, res) => {
//           if (req.session && req.session.passport) {
//              userObj = req.session.passport.user;
//            }
//
//           res.render('updateuser', {
//                   userObj: userObj,
//                   updateendpoint: '/process_user_update'
//           });
//    });  //end UPDATE request
//
//
//
//       props.post('/process_user_update', urlencodedParser, (req, res) => {
//              const data = req.body
//              console.log("Just got form: "+JSON.stringify(data)+"<br>")
//              //check if they entered the right old password
//              //function authUser (email, password, done) {
//              //pModel.authUser (username, password, (err, autheduser) => {
//
//              var updatedUser =
//              {
//                "id":userObj.id,
//                "firstname":data.firstname,
//                "lastname":data.lastname,
//                "email":data.email,
//                "photo":data.photo,
//                "password": "nopass"
//              }
//
//
//              //hash the NEW password - changing password
//               bcrypt.genSalt(10, function(err, salt) {
//                      if (err) return err;
//                      bcrypt.hash(data.newpass, salt, function(err, hash) {
//                             console.log("hashing "+err)
//                             if (err) return err;
//                             if (data.newpass === "") {
//                                 updatedUser.password = userObj.password;
//                             } else {
//                                  updatedUser.password = hash
//                             }
//                             console.log("\n\nHere is the New User v5 "+JSON.stringify(updatedUser))
//                             pModel.updateUser (updatedUser, (err, status) => {
//                                    //err comes back but not results
//                                    if (err) {
//                                      console.log("\n\nModel Update problem "+JSON.stringify(err));
//                                    } else {
//                                    req.flash('login', "Updated USER "+updatedUser.lastname+".  ")
//                                    console.log("Updated  "+updatedUser.lastname+" with " +JSON.stringify(status));
//                                    res.redirect('/home');
//                                    }
//                            });//updateuser
//                    }); //hash
//            }); //getSalt
//     }); //===== END PROCESS USER UPDATE
