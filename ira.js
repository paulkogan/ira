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
const iraVersion = "0.9.2 +investor portfolio+parse commas"
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
     return "$"+amount.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
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

  async function totalupPortfolio (investments) {
        let portfolioRows = investments
        let totalPortfolioValue = 0;
        let totalInvestmentValue = 0;
        for (let index = 0; index < investments.length; index++) {
               var deal = await iraSQL.getDealById(portfolioRows[index].deal_id);
               var expandDeal = calculateDeal(deal[0]);
               portfolioRows[index].deal_equity_value = expandDeal.equity_value
               portfolioRows[index].investor_equity_value = portfolioRows[index].deal_equity_value*(portfolioRows[index].capital_pct/100);
               totalPortfolioValue += portfolioRows[index].investor_equity_value
               totalInvestmentValue += portfolioRows[index].amount;
               portfolioRows[index].formatted_amount = formatCurrency(portfolioRows[index].amount)
               portfolioRows[index].formatted_deal_equity_value = formatCurrency(expandDeal.equity_value)
               portfolioRows[index].formatted_investor_equity_value = formatCurrency(portfolioRows[index].investor_equity_value)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for
        return [portfolioRows, formatCurrency(totalInvestmentValue), formatCurrency(totalPortfolioValue)];
    } //function




  function calculateOwnership (transactionsFromEntity) {
        var ownershipRows = transactionsFromEntity
        var totalCapital = 0;

        for (let index = 0; index < ownershipRows.length; index++) {
               totalCapital += ownershipRows[index].amount;
        }
        // now calculate % for each
        for (let index = 0; index < ownershipRows.length; index++) {
               ownershipRows[index].percent = (ownershipRows[index].amount/totalCapital)
               ownershipRows[index].formattedPercent = (ownershipRows[index].percent*100).toFixed(2)+"%"
               ownershipRows[index].formattedAmount = formatCurrency(ownershipRows[index].amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [ownershipRows, formatCurrency(totalCapital)];
    } //function


  function calculateDeal (deal) {
        console.log("\nin CalculateDeal, Deal is  "+JSON.stringify(deal));
         let expandDeal = deal
         //expandDeal.equity_value = 999
         //expandDeal.equity_value = expandDeal.aggregate_value
         expandDeal.equity_value = expandDeal.aggregate_value+expandDeal.cash_assets-expandDeal.deal_debt-expandDeal.aggregate_debt
         expandDeal.total_value = formatCurrency(expandDeal.aggregate_value + expandDeal.cash_assets)
         expandDeal.total_debt = formatCurrency(expandDeal.aggregate_debt + expandDeal.deal_debt)
         expandDeal.aggregate_value = formatCurrency(expandDeal.aggregate_value)
         expandDeal.cash_assets = formatCurrency(expandDeal.cash_assets)
         expandDeal.aggregate_debt = formatCurrency(expandDeal.aggregate_debt)
         expandDeal.deal_debt  = formatCurrency(expandDeal.deal_debt)
         expandDeal.formatted_equity_value =formatCurrency(expandDeal.equity_value)
        console.log("\nin CalculateDeal, expandDeal is  "+JSON.stringify(expandDeal));
        return expandDeal;
    } //function




//============ ROUTES  ======================



app.get('/portfolio/:id', (req, res) => {
    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }

     showInvestorPortfolio().catch(err => {
           console.log("investor portfolio problem: "+err);
           req.flash('login', "Problems getting Portfolio "+req.params.id+".  ")
           res.redirect('/home')
     })

     async function showInvestorPortfolio() {
           let investments = await iraSQL.getOwnershipForInvestor(req.params.id);
           console.log("In InvestorPortfolio, here are all investments: "+JSON.stringify(investments)+"\n\n");
           if (investments.length > 0) {
                          let results = await totalupPortfolio(investments)
                          let portfolio = results[0]
                          let totalInvestmentValue =  results[1]
                          let totalPortfolioValue =  results[2]
                          console.log("\nrendering Portfolio : " + JSON.stringify(portfolio)+"\n\n")
                          res.render('portfolio-details', {
                                  userObj: userObj,
                                  message:  "Showing "+portfolio.length+" investments ",
                                  investorName: investments[0].investor_name,
                                  investments: portfolio,
                                  totalPortfolioValue: totalPortfolioValue,
                                  totalInvestmentValue: totalInvestmentValue
                          });

                    } else { //no ownership data
                          res.redirect('/home/')

                } //if ownership
     } //async function
}); //route - ownership






app.post('/process_set_ownership', urlencodedParser, (req, res) => {
  //call the async function
  insertOwnershipAndUpdateEntity().catch(err => {
        console.log("Insert Ownership problem: "+err);
  })

  async function insertOwnershipAndUpdateEntity() {
            let formTransIds = req.body.trans_ids
            let formPercents = req.body.percents
            let ownEntityId = 0
            console.log("POST from Set Ownsership form we got: "+JSON.stringify(req.body)+"\n\n");
            console.log("POST from Set Ownsership "+JSON.stringify(formTransIds)+"\n");

            // get each transaction, total capital,
            //calculate %,
            //push new Ownership Row
            //
            for (let i=0;i<formTransIds.length;i++) {
                    let transId = parseInt(formTransIds[i]);
                    console.log("Trans ID="+transId+"")
                    let transPercent = (formPercents[i]*100).toFixed(4);
                    console.log("Percent="+transPercent+"\n\n")
                    let trans = await iraSQL.getTransactionById(transId)
                    console.log("\nIn process, Inserting new ownership row from trans: "+JSON.stringify(trans)+"\n\n")
                    ownEntityId = trans[0].investment_entity_id
                    let newOwnershipRow = {
                           parent_entity_id: trans[0].investor_entity_id,
                           child_entity_id: trans[0].investment_entity_id,
                           transaction_id: transId,
                           capital_pct: transPercent,
                           member_interest_pct: null
                    }
                    var insertOwnershipResults = await iraSQL.insertOwnership(newOwnershipRow);
                    req.flash('login', "In deals, added ownership #: "+insertOwnershipResults.insertId);

          } //for loop

          //change entity status
          let entityWithOwnership =  await iraSQL.getEntityById(ownEntityId)
          console.log("Want to update Entity Own status for "+JSON.stringify(entityWithOwnership)+"\n");
          entityWithOwnership.ownership_status = 1;
          //entityWithOwnership.taxid = "EIN 444-7777";
          var updateEntityResults = await iraSQL.updateEntity(entityWithOwnership);
          console.log("\nUpdated Ownership Status, status: "+updateEntityResults+"\n\n")
          res.redirect('/entities');


    } //async function
  }) //route






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
           let foundEntity = await iraSQL.getEntityById(req.params.id);
           //console.log("in OWN, have Entity   "+ JSON.stringify(foundEntity));
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
                          //console.log("in get all ENTITIES, we got:   "+JSON.stringify(entities[0]))
                          var expandEntities = entities;

                          // for (let index = 0; index < entities.length; index++) {
                          //
                          //      } //
                          // }//for


                          res.render('list-investors', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" investors.",
                                  entities: expandEntities
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






app.get('/setownership/:id', (req, res) => {

    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }

    //call the async function
    pullOwnershipTransactions().catch(err => {
          console.log("SET ownership transactions problem: "+err);
    })

    async function pullOwnershipTransactions() {
          var entity = await iraSQL.getEntityById(req.params.id);
          console.log("in set-ownership, got Entity   "+ JSON.stringify(entity)+"\n\n");
          var rows = await iraSQL.getTransactionsForEntity(entity.id);
          console.log("\nGot "+rows.length+" transactions for "+ entity.name+":  "+JSON.stringify(rows)+"\n\n");
                  // screen transaction and calculate ownership
          if(entity.ownership_status===0 && (rows.length >0) ) {
                                var results = calculateOwnership(rows);
                                let ownershipRows = results[0]
                                let totalCapital =  results[1]
                                console.log("Rendering proposed ownership for "+ownershipRows[0].investment_name+"  total capital is: "+totalCapital)
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
              taxid: formDeal.taxid,
              ownership_status: 0
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
          var entity = await iraSQL.getEntityById(req.params.id);
          console.log("have Entity   "+ JSON.stringify(entity));
          var deals = await iraSQL.getDealById(entity.deal_id);
          console.log("Before Ownership, have Entity   "+ entity.name+"   and Deal is  "+JSON.stringify(deals));
          var investors = await iraSQL.getOwnershipForEntity(entity.id)
          if (investors.length>0) {
                                let results = totalupInvestors(investors)
                                let expandInvestors = results[0]
                                let totalCapital =  results[1]
                                let totalCapitalPct = results[2]
                                let expandDeal = calculateDeal(deals[0])
                                console.log("\nrendering ownership and Deal is "+JSON.stringify(deals))
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
    console.log("\nAbout to insert new transaction with "+JSON.stringify(transaction)+"\n");
    transaction.amount = transaction.amount.replace(/(,|\$)/g,"")

    iraSQL.insertTransaction(transaction).then (
        function (savedData) {
            //console.log( "Added entity #: "+savedData.insertId);
            req.flash('login', "Added transaction no. "+savedData.insertId);
            console.log("\nAdded transaction no. "+savedData.insertId);
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
