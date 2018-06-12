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
const secret = "cat"

const nodePort = 8081
//var router = express.Router();  then call router.post('/')


  app.set('trust proxy', true);
  app.use(flash());
  app.use(cookieParser(secret));
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json());


  const iraSQL =  require('./ira-model');
  var menus = require('./ira-menus.js');
  //require('./ira-menus')(app); //other approach
  app.use(menus)

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
  app.use(passport.authenticate('session'));
;



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

// Start the server
const server = app.listen(nodePort, function() {
  console.log('IRA listening on port  ' + nodePort);
});

var iraVersion = "0.10.5.2 +trans list with type"

module.exports = app;
exports.version = iraVersion;


//============ FUNCTIONS ======================

function formatCurrency (amount) {
     return "$"+amount.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
}


function totalupInvestors (investors) {
      let expandInvestors = []
      let totalCapital = 0;
      let totalCapitalPct =0.0000;
      for (let index = 0; index < investors.length; index++) {
            let alreadyExists = false
            for (let j = 0; j < expandInvestors.length; j++) {
                    if (expandInvestors[j].id === investors[index].id) {
                            expandInvestors[j].wired_date = "Multiple wires for investment"
                            console.log("\nMULTIPLE transaction for: " +JSON.stringify(expandInvestors[j])+"  \n");
                            alreadyExists = true
                            break
                    } //if
            }  //for loop checking existing own rows

            if (!alreadyExists) {  //not a duplicate
                    expandInvestors[index] = investors[index]
                    totalCapital += investors[index].amount;
                    totalCapitalPct += investors[index].capital_pct;
                    expandInvestors[index].formattedAmount = formatCurrency(expandInvestors[index].amount)
                    console.log("\nin TUI - Adding own row " +JSON.stringify(expandInvestors[index])+"  \n");
            } //if not a dupe

      }//for index --- all own rows with transactions
      console.log("in TotalUpInvestors sending: " +totalCapitalPct+"%  ");
      return [expandInvestors, formatCurrency(totalCapital), totalCapitalPct.toFixed(2)];
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
        var inv_trans_Rows = transactionsFromEntity
        var totalCapital = 0;

        for (let index = 0; index < inv_trans_Rows.length; index++) {
               totalCapital += inv_trans_Rows[index].amount;
               //add each investor to a table. If he's there before,

        }
        // now calculate % for each
        for (let index = 0; index < inv_trans_Rows.length; index++) {
               inv_trans_Rows[index].percent = (inv_trans_Rows[index].amount/totalCapital)
               inv_trans_Rows[index].formattedPercent = (inv_trans_Rows[index].percent*100).toFixed(4)+"%"
               inv_trans_Rows[index].formattedAmount = formatCurrency(inv_trans_Rows[index].amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [inv_trans_Rows, formatCurrency(totalCapital)];
    } //function


  function calculateDeal (deal) {
        //console.log("\nin CalculateDeal, Deal is  "+JSON.stringify(deal));
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
        //console.log("\nin CalculateDeal, expandDeal is  "+JSON.stringify(expandDeal));
        return expandDeal;
    } //function




//============ ROUTES  ======================



app.get('/portfolio/:id', (req, res) => {
    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }

     showInvestorPortfolio().catch(err => {
           console.log("investor portfolio problem: "+err);
           req.flash('login', "Problems getting Portfolio info for entity no. "+req.params.id+".  ")
           res.redirect('/home')
     })

     async function showInvestorPortfolio() {
           let foundEntity = await iraSQL.getEntityById(req.params.id);
           let investments = await iraSQL.getOwnershipForInvestor(foundEntity.id);
           console.log("In /portfolio/id, here are all investments: "+JSON.stringify(investments)+"\n\n");
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
                          req.flash('login', "No portfolio info for "+foundEntity.name+".  ")
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
            let inv_trans = []
            let own_Rows = []
            for (let i=0;i<formTransIds.length;i++) {
                    let transId = parseInt(formTransIds[i]);
                    console.log("Trans ID="+transId+"")
                    let transPercent = (formPercents[i]*100).toFixed(4);
                    console.log("Percent="+transPercent+"\n\n")
                    let trans = await iraSQL.getTransactionById(transId)

                    ownEntityId = trans[0].investment_entity_id
                    let inv_trans_row = {
                           parent_entity_id: trans[0].investor_entity_id,
                           child_entity_id: trans[0].investment_entity_id,
                           passthru_entity_id: trans[0].passthru_entity_id,
                           trans_id: transId,  //need this for lookup table!
                           trans_amount: trans[0].amount,
                           capital_pct: parseFloat(transPercent),
                           member_interest_pct: null
                    }
                    console.log("\nIn process, Inserting new inv_trans row: "+JSON.stringify(inv_trans_row)+"\n\n")
                    inv_trans.push(inv_trans_row);

                    let found = false
                    for (let j=0;j<own_Rows.length;j++) {
                            if(own_Rows[j].parent_entity_id === inv_trans[i].parent_entity_id) {
                                    own_Rows[j].amount += inv_trans[i].trans_amount;
                                    own_Rows[j].capital_pct += inv_trans[i].capital_pct*1;
                                    found = true;
                                    break;
                            }

                    } //for j

                    if(!found) { //add new own_row
                              let own_row = {
                                     parent_entity_id: inv_trans[i].parent_entity_id,
                                     child_entity_id: inv_trans[i].child_entity_id,
                                     passthru_entity_id: inv_trans[i].passthru_entity_id,
                                     transaction_id: null,
                                     amount: inv_trans[i].trans_amount,
                                     capital_pct: inv_trans[i].capital_pct,
                                     member_interest_pct: null
                              }
                              own_Rows.push(own_row);
                              console.log("\nIn setownership added ownRow "+JSON.stringify(own_row)+"\n");
                   }// if !found
            } //for - done creating own_rows


            //now add all own_rows to ownsrhip table
            for (let k=0;k<own_Rows.length;k++) {
                    var insertOwnershipResults = await iraSQL.insertOwnership(own_Rows[k]);
                    console.log("Added new ownership row, id= "+insertOwnershipResults.insertId);
                    //insert into own_trans lookup table
                    for (let l=0;l<inv_trans.length;l++) {
                           if (inv_trans[l].parent_entity_id === own_Rows[k].parent_entity_id) { //add lookup
                                 var insertOwnTransResults = await iraSQL.insertOwnTrans(
                                          insertOwnershipResults.insertId,
                                          inv_trans[l].trans_id);
                                  console.log("Added new own_trans lookup, results= "+JSON.stringify(insertOwnTransResults)+"  ow="+insertOwnershipResults.insertId+"  trans="+inv_trans[l].trans_id);
                           } //if its a match
                    } //l loop, in case there are multiple trans
            } //for loop k, for each ownership row

          //change entity status
          let entityWithOwnership =  await iraSQL.getEntityById(ownEntityId)
          console.log("Want to update Entity Own status for "+JSON.stringify(entityWithOwnership)+"\n");
          entityWithOwnership.ownership_status = 1;
          //entityWithOwnership.taxid = "EIN 444-7777";
          var updateEntityResults = await iraSQL.updateEntity(entityWithOwnership);
          console.log("\nUpdated Ownership Status, here results: "+updateEntityResults+"\n\n")
          res.redirect('/deals');







    } //async function
  }) //route





//show existing ownership
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
                          console.log("show -ownership is "+JSON.stringify(investors))
                          let results = totalupInvestors(investors)
                          let expandInvestors = results[0]
                          let totalCapital =  results[1]
                          let totalCapitalPct = (results[2]*1).toFixed(2)
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
                                console.log("in Setown, Rendering proposed ownership for "+ownershipRows[0].investment_name+"  total capital is: "+totalCapital)
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
