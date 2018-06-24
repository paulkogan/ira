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


const iraVersion = "0.14.2  +no_save update bug +adjustments dont roll up +aquisition offset"

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

hbs.registerHelper('ifIncludes', function(v1, v2, options) {
          if(v1.toString().includes(v2)) {
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



module.exports = app;
exports.version = iraVersion;


//============ FUNCTIONS ======================

function formatCurrency (amount) {
            if (amount >= 0) {
               return "$"+amount.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
            } else {
               return "($"+(-1*amount).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")+")";
            }
} //function


function parseFormAmountInput (fieldInput) {
    return fieldInput.replace(/(,|\$|\%)/g,"")
}


function doTransMatchForRollup (tt1,tt2) {
        if ( (tt1 === tt2) ||  (tt1 === 1 && tt2 ===5) ||(tt1 === 5 && tt2 ===1) ){
              return true;
        } else {
              return false;
        }

}



//FOR DISPLAY - got wonership rows, mith multiples for each wire
function totalupInvestors (investors) {
      console.log("\nTUI Found "+investors.length+" transaction rows")
      let expandInvestors = []
      let totalCapital = 0;
      let totalCapitalPct =0.0000;

      for (let index = 0; index < investors.length; index++) {
            let alreadyExists = false

            //check if
            for (let j = 0; j < expandInvestors.length; j++) {
                    //console.log("about to check trans "+index+" and expand-own "+j+"");

                    if (expandInvestors[j].id === investors[index].id) {

                            if (investors[index].t_type === 5 || expandInvestors[j].wired_date === "Multiple trans & own. adjust.") {
                                        expandInvestors[j].wired_date = "Multiple trans & own. adjust."

                            } else {

                                        expandInvestors[j].wired_date = "Multiple transactions"
                            }


                            console.log("\nTUI - rolling up transaction: "+index+" to ownership: "+j+" with wire date "+expandInvestors[j].wired_date+ " --  "+JSON.stringify(investors[index])+"  \n");
                            alreadyExists = true
                    } //if
                    if (alreadyExists) break;
            }  //for loop checking existing own rows

            if (!alreadyExists) {  //not a duplicate -- not adding sequentially
                    let newOwnRow =  investors[index]
                    totalCapital += investors[index].amount;
                    totalCapitalPct += investors[index].capital_pct;
                    newOwnRow.formattedAmount = formatCurrency(investors[index].amount)
                    expandInvestors.push(newOwnRow)
                    console.log("\nTUI - NEW own_row: "+(expandInvestors.length-1)+" from transaction: "+index+"  :" +JSON.stringify(newOwnRow)+"  \n");

// TUI - NEW own_row: 3 from transaction: 6  :{"id":493,"investor_name":"Alex Abrahms",
// "investment_name":"Horizon LP",
// "passthru_name":null,
// "wired_date":"Apr 11 2018",
// "t_type":5,
// "amount":199000,
// "capital_pct":38.5682,
// "formattedAmount":"$199,000"}


            } //if not a dupe

      }//for index --- all own rows with transactions
      console.log("in TotalUpInvestors sending: " +totalCapitalPct+"%  ");
      return [expandInvestors, formatCurrency(totalCapital), totalCapitalPct.toFixed(2)];
  } //function



  async function totalupCashInDeal (transactions) {
        let expandTransactions = transactions
        let totalCashInDeal = 0.0;

        for (let index = 0; index < transactions.length; index++) {

                totalCashInDeal += expandTransactions[index].amount
                if(transactions[index].t_type === "Owner. Adjust." ) {
                        expandTransactions[index].formatted_amount = transactions[index].own_adj+"%";
                } else {
                        expandTransactions[index].formatted_amount = formatCurrency(expandTransactions[index].amount)
                }

        } //for

        console.log ("TotalCash remaininf for deal"+transactions[0].investment_name+" is "+ totalCashInDeal+"\n\n")
        return [expandTransactions, formatCurrency(totalCashInDeal) ];

    } //function totalupCashInDeal



    async function totalupInvestorPortfolio (investments) {
          let portfolioDeals = []  //empty array - add only if its a deal
          let totalPortfolioValue = 0;
          let totalInvestmentValue = 0;

          for (let index = 0; index < investments.length; index++) {

               if (investments[index].deal_id) {
                             let deal = await iraSQL.getDealById(investments[index].deal_id);
                             let expandDeal = calculateDeal(deal[0])
                             console.log (index+") Investment for ENTITY_ID :"+investments[index].investment_id+" - "+investments[index].investment_name+"\n")
                             let transactionsForDeal = await iraSQL.getTransactionsForInvestorAndEntity(investments[index].investor_id, investments[index].investment_id,[1,3,5,6]);
                             console.log ("TU Inv.Portfolio - got "+transactionsForDeal.length+" transactions for deal "+index+"  : "+JSON.stringify(transactionsForDeal, null, 4)+"\n")

                             let result = await totalupCashInDeal(transactionsForDeal);
                             //first copy the deal basics
                             let newPortfolioDeal = investments[index];
                             newPortfolioDeal.expandDeal = expandDeal;
                             newPortfolioDeal.transactionsForDeal = result[0];
                             newPortfolioDeal.totalCashInDeal = result[1];
                             newPortfolioDeal.investor_equity_value = newPortfolioDeal.expandDeal.equity_value*(newPortfolioDeal.capital_pct/100);

                             //add the sums
                             totalPortfolioValue += newPortfolioDeal.investor_equity_value
                             totalInvestmentValue += newPortfolioDeal.amount;
                             newPortfolioDeal.formatted_amount = formatCurrency(newPortfolioDeal.amount)
                             newPortfolioDeal.formatted_deal_equity_value = formatCurrency(newPortfolioDeal.expandDeal.equity_value)
                             newPortfolioDeal.formatted_investor_equity_value = formatCurrency(newPortfolioDeal.investor_equity_value)
                             portfolioDeals.push(newPortfolioDeal);
              } else {
                            //dont add to array of portfolioDeals
                            console.log ("\n"+index+") Investment for ENTITY_ID :"+investments[index].investment_id+" "+investments[index].investment_name+" is not a DEAL \n")
                            let transactionsForEntity = await iraSQL.getTransactionsForInvestorAndEntity(investments[index].investor_id, investments[index].investment_id,[1,3,5,6]);
                            console.log ("TUIP - got "+transactionsForEntity.length+" transactions for entity "+investments[index].investment_name+"  : "+JSON.stringify(transactionsForEntity, null, 4)+"\n")

                            let result = await totalupCashInDeal(transactionsForEntity);
                            let newPortfolioDeal = investments[index];

                            let expandDeal =  {
                                       "id": investments[index].id,
                                       "name": investments[index].investment_name,
                                       "aggregate_value": 0,
                                       "cash_assets": 0,
                                       "aggregate_debt": 0,
                                       "deal_debt": 0,
                                       "notes": "",
                                       "equity_value": 0,
                                       "total_value": 0,
                                       "total_debt": 0,
                                       "formatted_total_value": "$0",
                                       "formatted_total_debt": "$0",
                                       "formatted_aggregate_value": "$0",
                                       "formatted_cash_assets": "$0",
                                       "formatted_aggregate_debt": "$0",
                                       "formatted_deal_debt": "$0",
                                       "formatted_equity_value": "$0"
                            };


                            newPortfolioDeal.expandDeal = expandDeal;
                            newPortfolioDeal.transactionsForDeal = result[0];
                            newPortfolioDeal.totalCashInDeal = result[1];
                            newPortfolioDeal.investor_equity_value = newPortfolioDeal.expandDeal.equity_value*(newPortfolioDeal.capital_pct/100);

                            //add the sums
                            totalPortfolioValue += newPortfolioDeal.investor_equity_value
                            totalInvestmentValue += newPortfolioDeal.amount;
                            newPortfolioDeal.formatted_amount = formatCurrency(newPortfolioDeal.amount)
                            newPortfolioDeal.formatted_deal_equity_value = formatCurrency(newPortfolioDeal.expandDeal.equity_value)
                            newPortfolioDeal.formatted_investor_equity_value = formatCurrency(newPortfolioDeal.investor_equity_value)
                            portfolioDeals.push(newPortfolioDeal);




              }

               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for
        return [portfolioDeals, totalInvestmentValue, totalPortfolioValue];
    } //function




  function calculateOwnership (transactionsFromEntity) {
        var inv_trans_Rows = transactionsFromEntity
        var totalCapital = 0;
        var totalAdjOwnPct = 0
        var totalOwnPct = 0
        console.log("In CalculateOwnership, here are "+transactionsFromEntity.length+" transcations :"+JSON.stringify(transactionsFromEntity,null,4)+"\n\n")

        for (let index = 0; index < inv_trans_Rows.length; index++) {
               totalCapital += inv_trans_Rows[index].amount;
               totalAdjOwnPct += inv_trans_Rows[index].own_adj;
               //add each investor to a table. If he's there before,

        }
        console.log("In CalculateOwnership, the TotaCap is "+totalCapital+"\n")


       //Math.round((totalAdjOwnPct*1000)/1000).toFixed(4)
       let availPct_after_OwnAdj = (100-totalAdjOwnPct)/100
       //console.log("\nIn CalculateOwnership, Adust Onership % is "+totalAdjOwnPct+" and remaining % as decimal is "+availPct_after_OwnAdj+" \n")

        // now calculate % for each
        for (let index = 0; index < inv_trans_Rows.length; index++) {
                if(inv_trans_Rows[index].own_adj > 0) {  //if its an ownership adjustment (% only)
                      inv_trans_Rows[index].percent = (inv_trans_Rows[index].own_adj)/100
                } else {
                      // if (inv_trans_Rows[index].trans_type === 6) {  //its an offset
                      //           inv_trans_Rows[index].percent = 0
                      // }  else {
                      inv_trans_Rows[index].percent = ((inv_trans_Rows[index].amount/totalCapital)*availPct_after_OwnAdj)

                      //} //if not a n offset
                } //if its ownership %

               totalOwnPct += inv_trans_Rows[index].percent*100
              // console.log("\nIn CalculateOwnership, after: "+inv_trans_Rows[index].id + "the % total is "+  totalOwnPct+"\n");
               inv_trans_Rows[index].formattedPercent = (inv_trans_Rows[index].percent*100).toFixed(4)+"%"
               inv_trans_Rows[index].formattedAmount = formatCurrency(inv_trans_Rows[index].amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [inv_trans_Rows, totalCapital, totalAdjOwnPct, totalOwnPct];
    } //function


  function calculateDeal (deal) {
        //console.log("\nin CalculateDeal, Deal is  "+JSON.stringify(deal));
         let expandDeal = deal
         //expandDeal.equity_value = 999
         //expandDeal.equity_value = expandDeal.aggregate_value
         expandDeal.equity_value = expandDeal.aggregate_value+expandDeal.cash_assets-expandDeal.deal_debt-expandDeal.aggregate_debt
         expandDeal.total_value = expandDeal.aggregate_value + expandDeal.cash_assets
         expandDeal.total_debt = expandDeal.aggregate_debt + expandDeal.deal_debt
         expandDeal.formatted_total_value = formatCurrency(expandDeal.aggregate_value + expandDeal.cash_assets)
         expandDeal.formatted_total_debt = formatCurrency(expandDeal.aggregate_debt + expandDeal.deal_debt)
         expandDeal.formatted_aggregate_value = formatCurrency(expandDeal.aggregate_value)
         expandDeal.formatted_cash_assets = formatCurrency(expandDeal.cash_assets)
         expandDeal.formatted_aggregate_debt = formatCurrency(expandDeal.aggregate_debt)
         expandDeal.formatted_deal_debt  = formatCurrency(expandDeal.deal_debt)
         expandDeal.formatted_equity_value =formatCurrency(expandDeal.equity_value)
        //console.log("\nin CalculateDeal, expandDeal is  "+JSON.stringify(expandDeal));
        return expandDeal;
    } //function




//============ ROUTES  ======================

app.get('/clearownership/:id', (req, res) => {
    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }

     clearOwnership().catch(err => {
           console.log("Clear Ownership problem: "+err);
           req.flash('login', "Problems getting Ownership info for entity no. "+req.params.id+".  ")
           res.redirect('/home')
     })

     async function clearOwnership() {
           let foundEntity = await iraSQL.getEntityById(req.params.id);
           let ownershipRows = await iraSQL.getOwnershipForEntity(foundEntity.id);
           console.log("In /clearownership/id, got "+ownershipRows.length+ " ownership rows: "+JSON.stringify(ownershipRows,null,4)+"\n\n");
           let own_ids = [];
           for (let i=0; i<ownershipRows.length; i++) {
                own_ids[i] = ownershipRows[i].id
           }

           let results = await iraSQL.clearOwnershipForEntity(foundEntity.id,own_ids);
           console.log("Cleared ownership for "+foundEntity.name+"\n");
           //+"results : "+JSON.stringify(results,null,6)+"\n");
           req.flash('login', "Cleared ownership for "+foundEntity.name+".  ");
           res.redirect('/setownership/');

     } //async function
}); //route - ownership




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
           console.log("In /portfolio/id, got "+investments.length+ " investments: "+JSON.stringify(investments,null,4)+"\n\n");
           if (investments.length > 0) {
                          let results = await totalupInvestorPortfolio(investments)
                          let portfolioDeals = results[0]
                          let totalInvestmentValue =  results[1]
                          let totalPortfolioValue =  results[2]
                          let portfolioGain =  totalPortfolioValue-totalInvestmentValue
                          let portfolioIRR = parseFloat(portfolioGain/totalInvestmentValue)*100
                          console.log("\nrendering Portfolio, 1st Deal : " + JSON.stringify(portfolioDeals[0],null,6)+"\n\n")
                          res.render('portfolio-details', {
                                  userObj: userObj,
                                  message:  "Showing "+portfolioDeals.length+" investments ",
                                  investorName: investments[0].investor_name,
                                  investments: portfolioDeals,
                                  totalPortfolioValue: formatCurrency(totalPortfolioValue),
                                  totalInvestmentValue: formatCurrency(totalInvestmentValue),
                                  portfolioGain: formatCurrency(portfolioGain),
                                  portfolioIRR: portfolioIRR.toFixed(2)
                          });

                    } else { //no ownership data
                          req.flash('login', "No portfolio info for "+foundEntity.name+".  ")
                          res.redirect('/home/')

                } //if ownership
     } //async function
}); //route - ownership












app.get('/updatedeal/:id', (req, res) => {

    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }

    //call the async function
    pullDealDetails().catch(err => {
          console.log("Pull Deal Details problem: "+err);
    })

    async function pullDealDetails() {
          var entity = await iraSQL.getEntityById(req.params.id);
          console.log("have Entity   "+ JSON.stringify(entity));
          var deals = await iraSQL.getDealById(entity.deal_id);
          console.log("\nGot raw Deal to edit  "+JSON.stringify(deals));

          let expandDeal = calculateDeal(deals[0])
          console.log("\nDeal ready to edit  "+JSON.stringify(expandDeal));
          res.render('update-deal', {
                userObj: userObj,
                message: "Updating Deal: " + expandDeal.id,
                dealEIN: entity.taxid,
                deal: expandDeal,
                postendpoint: '/process_update_deal'
          }); //  render

      } //async function pullDealDetails
}); //route - update deal




// insert the new deal and corresponding entity
app.post('/process_update_deal', urlencodedParser, (req, res) => {

  //call the async function
  updateDealAndEntity().catch(err => {
        console.log("Deal and Entity problem: "+err);
  })

  async function updateDealAndEntity() {
            let formDeal = req.body
            let updatedDeal = {
              id:formDeal.id,
              name: formDeal.name,
              aggregate_value: parseFormAmountInput(formDeal.aggregate_value),
              cash_assets: parseFormAmountInput(formDeal.cash_assets),
              aggregate_debt: parseFormAmountInput(formDeal.aggregate_debt),
              deal_debt: parseFormAmountInput(formDeal.deal_debt),
              notes: formDeal.notes
            }
            console.log("\nUpdated deal, ready to send to SQL  "+JSON.stringify(updatedDeal));

            let updateDealResults = await iraSQL.updateDeal(updatedDeal);
            console.log( "Updated deal  no.: "+updatedDeal.id);
            req.flash('login', "UpdatedDeal: "+updatedDeal.id);

            let oldDealEntity = await iraSQL.getEntityByDealId(updatedDeal.id);
            console.log( "OldEntity for deal: "+JSON.stringify(oldDealEntity));

            let newDealEntity = oldDealEntity;
            newDealEntity.name =  updatedDeal.name;
            newDealEntity.taxid = formDeal.taxid;

            var updateEntityResults = await iraSQL.updateEntity(newDealEntity);
            //req.flash('login', "In deals, added entity #: "+insertEntityResults.insertId);

            res.redirect('/deals');

   } //async function
}); //process add-deal route








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
              aggregate_value: parseFormAmountInput(formDeal.aggregate_value),
              cash_assets: parseFormAmountInput(formDeal.cash_assets),
              aggregate_debt: parseFormAmountInput(formDeal.aggregate_debt),
              deal_debt: parseFormAmountInput(formDeal.deal_debt),
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
                    console.log("====START Trans #"+i+" =======\n Trans ID="+transId+"")
                    let transPercent = (formPercents[i]*100).toFixed(4);
                    console.log("Percent="+transPercent+"\n")
                    let trans = await iraSQL.getTransactionById(transId) //basic info

                    ownEntityId = trans[0].investment_entity_id
                    let inv_trans_row = {
                           parent_entity_id: trans[0].investor_entity_id,
                           child_entity_id: trans[0].investment_entity_id,
                           passthru_entity_id: trans[0].passthru_entity_id,
                           trans_id: transId,  //need this for lookup table!
                           trans_amount: trans[0].amount,
                           capital_pct: parseFloat(transPercent),
                           member_interest_pct: null,
                           trans_type: trans[0].trans_type,
                           ownRow_id:null
                    }
                    console.log("\nIn processSetOwn, add inv_trans row to table: "+JSON.stringify(inv_trans_row)+"")
                    inv_trans.push(inv_trans_row);

                    let found = false
                    for (let j=0;j<own_Rows.length;j++) {
                            //ROLL UP if its the same parent entity (investor)
                              //if((own_Rows[j].parent_entity_id === inv_trans[i].parent_entity_id)  && (own_Rows[j].trans_type != 5) && (inv_trans[i].trans_type != 5 )    ) {
                              if( own_Rows[j].parent_entity_id === inv_trans[i].parent_entity_id ) {
                                    own_Rows[j].amount += inv_trans[i].trans_amount;
                                    own_Rows[j].capital_pct += inv_trans[i].capital_pct*1;
                                    inv_trans[i].ownRow_id = j;
                                    console.log("\nRolled up trans "+inv_trans[i].trans_id+"to existing own_row_id "+j+"\n")
                                    found = true;
                                    break;
                            }

                    } //for j

                    if(!found) { //add new own_row
                              let own_row = {
                                     parent_entity_id: inv_trans[i].parent_entity_id,
                                     child_entity_id: inv_trans[i].child_entity_id,
                                     passthru_entity_id: inv_trans[i].passthru_entity_id,
                                     amount: inv_trans[i].trans_amount,
                                     capital_pct: inv_trans[i].capital_pct,
                                     member_interest_pct: null

                              }

                              own_Rows.push(own_row);
                              //note whoch own_Row this trasaction is part-of, so we can later add to own_trans table.
                              inv_trans[i].ownRow_id = own_Rows.length;
                              console.log("\nPushed NEW ownRow no."+own_Rows.length+" into table for trans: "+inv_trans[i].trans_id+"\n");
                   }// if !found
            } //for - done creating own_rows

             console.log("\nDONE creating own_rows, now inserting...==================\n\n")
            //now add all own_rows to ownsrhip table

            for (let k=0;k<own_Rows.length;k++) {
                    var insertOwnershipResults = await iraSQL.insertOwnership(own_Rows[k]);
                    console.log("\nAdded new ownership row, id= "+insertOwnershipResults.insertId);

                //go through all transactions, and if they roll up to this own owmRow, insert into own_trans lookup table
                    for (let l=0;l<inv_trans.length;l++) {
                           if (  (inv_trans[l].ownRow_id === k)) {
                                 var insertOwnTransResults = await iraSQL.insertOwnTrans(
                                          insertOwnershipResults.insertId,
                                          inv_trans[l].trans_id);
                                  console.log("Added new own_trans lookup, ow="+insertOwnershipResults.insertId+"  trans="+inv_trans[l].trans_id);
                           } //if its a match
                    } //l loop, in case there are multiple trans
            } //for loop k, for each ownership row

          //change entity status
          let entityWithOwnership =  await iraSQL.getEntityById(ownEntityId)
          console.log("\nWant to update Entity Ownership status for "+JSON.stringify(entityWithOwnership)+"\n");
          entityWithOwnership.ownership_status = 1;
          //entityWithOwnership.taxid = "EIN 444-7777";
          var updateEntityResults = await iraSQL.updateEntity(entityWithOwnership);
          //console.log("\nUpdated Ownership Status, here results: "+updateEntityResults+"\n\n")
          res.redirect('/setownership');





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
                          console.log("show-Ownership rows with DATE JOIN are: "+JSON.stringify(investors,null,4))
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
          console.log("in set-ownership, got Entity   "+ JSON.stringify(entity,null,4)+"\n\n");
          var rows = await iraSQL.getTransactionsForEntity(entity.id, [1,5,6]);
          console.log("\nIn SetOwn - got "+rows.length+" transactions for "+ entity.name+" \n");
                  // screen transaction and calculate ownership
          if(entity.ownership_status===0 && (rows.length >0) ) {
                                var results = calculateOwnership(rows);
                                let ownershipRows = results[0]
                                let totalCapital =  results[1]
                                let totalAdjOwnPct =  results[2]
                                let totalOwnPct =  results[3]

                                console.log("in Setown, Rendering proposed ownership for "+ownershipRows[0].investment_name+"  total capital is: "+totalCapital)
                                res.render('set-ownership', {
                                        userObj: userObj,
                                        message:  "Showing "+ownershipRows.length+" transactions",
                                        entityName: entity.name,
                                        investors: ownershipRows,
                                        totalCapital: formatCurrency(totalCapital),
                                        totalAdjOwnPct: Math.round((totalAdjOwnPct*1000)/1000).toFixed(4),
                                        totalOwnPct: Math.round((totalOwnPct*1000)/1000).toFixed(4),
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

        iraSQL.getEntitiesByTypes([1,3,4]).then(
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
    transaction.amount = parseFormAmountInput(transaction.amount)
    transaction.own_adj = parseFloat(transaction.own_adj)
    if ((transaction.trans_type==3 || transaction.trans_type==6) && transaction.amount>0) transaction.amount*=-1
    console.log("\nAbout to insert new transaction with "+JSON.stringify(transaction)+"\n");
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
      if (parseInt(entity.type) === 2) {
          entity.ownership_status = 2
      } else {
          entity.ownership_status = 0
      }


      console.log("From ADD Entity Form, we got: "+JSON.stringify(entity)+"\n\n");
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
