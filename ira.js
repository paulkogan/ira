'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm')
//vm.runInThisContext(fs.readFileSync(__dirname + "/extfile.js"))

const express = require('express');
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


const iraVersion = "0.16.3  +CSV download +clean up Total Investor Value +start Entity Value"

  app.set('trust proxy', true);
  app.use(flash());
  app.use(cookieParser(secret));
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json());
  app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
  });

  const calc =  require('./ira-calc');
  const iraSQL =  require('./ira-model');
  const menus = require('./ira-menus.js');
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


function shutDownServer() {
     server.close();
     console.log("server is winding down... but terminal pro cess still up\n");

}

module.exports = {
      app,
      shutDownServer
}

exports.version = iraVersion;
//exports.nodeServer = server;




//============ ROUTES  ======================

app.get('/api/searchentities/:term', (req, res, next) => {
          api_searchEntities().catch(err => {
                console.log("API search Entity problem: "+err);
          })

      async function api_searchEntities() {
            try {

                  var entList = await iraSQL.searchEntities (req.params.term);
                  if (entList.length <1) {
                              var entList = [{
                                id:0,
                                name: "Not found"
                              }]

                  }
                  console.log("\nGot entities: "+JSON.stringify(entList,null,5));

            } catch (err ){
                  console.log(err+ " -- No entities for    "+ req.params.term);
                  var entList = [{
                    id:0,
                    name: "Not found"
                  }]

            }


            res.send(JSON.stringify(entList,null,3));

    }; //async function

}); //route

app.get('/api/searchentities/', (req, res, next) => {

          res.send("[]");
}); //route




app.get('/api/transforentity/:id', (req, res, next) => {
          api_transactionsForEntity().catch(err => {
                console.log("API trans for Entity problem: "+err);
          })

      async function api_transactionsForEntity() {
            try {
                  var entity = await iraSQL.getEntityById(req.params.id);
                  console.log("have Entity   "+ JSON.stringify(entity));
                  var transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                  console.log("\nGot transactions for entity  "+JSON.stringify(transactions,null,5));

            } catch (err ){
                  console.log(err+ " -- No entity for    "+ req.params.id);
                  var transactions = await iraSQL.getAllTransactions();

            }

            var cleanTransactions = transactions.map(function(element) {
                        let cleanTransaction = {
                            id :element.id,
                            investor_name :element.investor_name,
                            investment_name :element.investment_name,
                            passthru_name :element.passthru_name,
                            tt_name :element.tt_name,
                            t_wired_date :element.t_wired_date,
                            formatted_amount :calc.formatCurrency(element.t_amount),
                            t_own_adj :element.t_own_adj,
                            t_notes :element.t_notes
                        }
                        //res.json(cleanTransaction)

                        return cleanTransaction;
            });
            res.send(JSON.stringify(cleanTransactions,null,3));

    }; //async function

}); //route







app.get('/download_csv/:id', (req, res) => {
      downloadCSVTransactions().catch(err => {
            console.log("DownloadTransactions problem: "+err);
      })
      let fileName = "file";
      async function downloadCSVTransactions() {
            try {
                  var entity = await iraSQL.getEntityById(req.params.id);
                  console.log("have Entity   "+ JSON.stringify(entity));
                  var transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                  console.log("\nGot transactions for entity  "+JSON.stringify(transactions,null,5));
                  fileName = entity.name+"_IRA_Transactions.csv"

            } catch (err ){
                  console.log(err+ " -- No entity for    "+ req.params.id);
                  var transactions = await iraSQL.getAllTransactions();
                  fileName = "All_IRA_Transactions.csv"
                  var entity = {
                    id:0,
                    name: "Select filter"
                  }
            }

            var cleanTransactions = transactions.map(function(element) {
                        let cleanTransaction = {
                            id :element.id,
                            investor_name :element.investor_name,
                            investment_name :element.investment_name,
                            passthru_name :element.passthru_name,
                            tt_name :element.tt_name,
                            t_wired_date :element.t_wired_date,
                            formatted_amount :calc.formatCurrency(element.t_amount),
                            t_own_adj :element.t_own_adj,
                            t_notes :element.t_notes
                        }

                        return cleanTransaction;
            });


                  let transCSV = await calc.createCSVforDownload(cleanTransactions);
                  console.log("In ira, the CSV file is \n"+transCSV+"\n")

                  res.setHeader('Content-disposition', 'attachment; filename='+fileName);
                  res.set('Content-Type', 'text/csv');
                  res.status(200).send(transCSV);

    }; //async function

}); //route


app.get('/transactions/:id', (req, res) => {
    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }

    //call the async function
    showTransForEntity().catch(err => {
          console.log("Show trandsactions for entity problem: "+err);
    })

    async function showTransForEntity() {
          try {
                var entity = await iraSQL.getEntityById(req.params.id);
                console.log("have Entity   "+ JSON.stringify(entity));
                var transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                console.log("\nGot transactions for entity  "+JSON.stringify(transactions,null,5));

          } catch (err ){
                console.log(err+ " -- No entity for    "+ req.params.id);
                var transactions = await iraSQL.getAllTransactions();
                var entity = {
                  id:0,
                  name: "Select filter"
                }
          }

          var expandTransactions = transactions.map(function(e) {
                      e.formatted_amount = calc.formatCurrency(e.t_amount);
                      return e;
          });

          //shorten names to 30 chars for display in pulldown
          var rawEntities = await iraSQL.getEntitiesByTypes([1,3,4]);
          var entitiesForFilter = rawEntities.map(function(plank) {
                      plank.name = plank.name.substring(0,30);
                      return plank;
          });
          entity.name = entity.name.substring(0,30);

          //console.log("\nGot "+entitiesForFilter.length+" entities for Filter ");


          res.render('list-transactions', {
                  userObj: userObj,
                  sessioninfo: JSON.stringify(req.session),
                  message: req.flash('login') + "  Showing "+transactions.length+" transactions",
                  transactions: expandTransactions,
                  filterList: entitiesForFilter,
                  selectedEntity: entity,
                  postendpoint: '/process_transactions_filter'
          });//render

    } //async function
}); //route - ownership


//need this because we hit a submit button to send search
app.post('/process_transactions_filter', urlencodedParser, (req, res) => {

          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;
           }

           let filterEntity = req.body.filter_ent
             console.log("\nGot Filter entity"+filterEntity)
           res.redirect('/transactions/'+filterEntity);

})




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
           let foundInvestor = await iraSQL.getEntityById(req.params.id);
           let investments = await iraSQL.getOwnershipForInvestor(foundInvestor.id);
           console.log("In /portfolio/id, got "+investments.length+ " investments: "+JSON.stringify(investments,null,4)+"\n\n");
           if (investments.length > 0) {
                          let results = await calc.totalupInvestorPortfolio(investments)
                          let portfolioDeals = results[0]
                          let totalInvestmentValue =  results[1]
                          let totalPortfolioValue =  results[2]
                          let totalDistributions =  results[3]*-1 //make it positive here
                          let portfolioValueGain =  totalPortfolioValue-totalInvestmentValue
                          let portfolioCashGain = portfolioValueGain+ totalDistributions
                          let portfolioIRR = parseFloat(portfolioCashGain/totalInvestmentValue)*100
                          console.log("\nRendering Investor Portfolio, totalDistrib is  : " + totalDistributions+"")
                          console.log("\nexample 2nd Deal : " + JSON.stringify(portfolioDeals[1],null,6)+"\n\n")
                          res.render('portfolio-details', {
                                  userObj: userObj,
                                  message:  "Showing "+portfolioDeals.length+" investments ",
                                  investorName: investments[0].investor_name,
                                  investments: portfolioDeals,
                                  totalPortfolioValue: calc.formatCurrency(totalPortfolioValue),
                                  totalInvestmentValue: calc.formatCurrency(totalInvestmentValue),
                                  portfolioValueGain: calc.formatCurrency(portfolioValueGain),
                                  totalDistributions: calc.formatCurrency(totalDistributions),
                                  portfolioCashGain: calc.formatCurrency(portfolioCashGain),
                                  portfolioIRR: portfolioIRR.toFixed(2)
                          });

                    } else { //no ownership data
                          req.flash('login', "No portfolio info for "+foundInvestor.name+".  ")
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

          let expandDeal = calc.calculateDeal(deals[0])
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
              aggregate_value: calc.parseFormAmountInput(formDeal.aggregate_value),
              cash_assets: calc.parseFormAmountInput(formDeal.cash_assets),
              aggregate_debt: calc.parseFormAmountInput(formDeal.aggregate_debt),
              deal_debt: calc.parseFormAmountInput(formDeal.deal_debt),
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
              aggregate_value: calc.parseFormAmountInput(formDeal.aggregate_value),
              cash_assets: calc.parseFormAmountInput(formDeal.cash_assets),
              aggregate_debt: calc.parseFormAmountInput(formDeal.aggregate_debt),
              deal_debt: calc.parseFormAmountInput(formDeal.deal_debt),
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
                    console.log("====START Trans #"+i+" =======\nTrans ID="+transId+"")
                    let transPercent = (formPercents[i]*100).toFixed(4);
                    console.log("Percent="+transPercent+"\n")
                    let trans = await iraSQL.getTransactionById(transId) //basic info

                    //get the entity id
                    ownEntityId = trans[0].investment_entity_id

                    let inv_trans_row = {
                           parent_entity_id: trans[0].investor_entity_id,
                           child_entity_id: trans[0].investment_entity_id,
                           passthru_entity_id: trans[0].passthru_entity_id,
                           trans_id: transId,  //need this for lookup table!
                           t_amount: trans[0].amount,
                           capital_pct: parseFloat(transPercent),
                           member_interest_pct: null,
                           tt_id: trans[0].trans_type,
                           ownRow_id:null
                    }
                    console.log("In processSetOwn, add inv_trans row to table: "+JSON.stringify(inv_trans_row, null, 4)+"")
                    inv_trans.push(inv_trans_row);

                    let found = false
                    for (let j=0;j<own_Rows.length;j++) {
                            //ROLL UP if its the same parent entity (investor) - including own adjust
                              //if((own_Rows[j].parent_entity_id === inv_trans[i].parent_entity_id)  && (own_Rows[j].tt_id != 5) && (inv_trans[i].tt_id != 5 )    ) {
                              if( own_Rows[j].parent_entity_id === inv_trans[i].parent_entity_id ) {
                                    own_Rows[j].amount += inv_trans[i].t_amount;
                                    own_Rows[j].capital_pct += inv_trans[i].capital_pct*1;
                                    inv_trans[i].ownRow_id = j;
                                    console.log("\nRolled up trans "+inv_trans[i].trans_id+" to existing own_row_id "+j+"\n")
                                    found = true;
                                    break;
                            }

                    } //for j

                    if(!found) { //add new own_row
                              let own_row = {
                                     parent_entity_id: inv_trans[i].parent_entity_id,
                                     child_entity_id: inv_trans[i].child_entity_id,
                                     passthru_entity_id: inv_trans[i].passthru_entity_id,
                                     amount: inv_trans[i].t_amount,
                                     capital_pct: inv_trans[i].capital_pct,
                                     member_interest_pct: null

                              }

                              own_Rows.push(own_row);
                              //note whoch own_Row this trasaction is part-of, so we can later add to own_trans table.
                              //this could be a problem!


                              inv_trans[i].ownRow_id = own_Rows.length-1;
                              console.log("Pushed NEW ownRow into table for trans: "+inv_trans[i].trans_id+"\n");
                              console.log("THE SIZE OF OWN_ROWS IS: "+own_Rows.length+"\n");
                              console.log("\nThe inv_trans looks like:"+ JSON.stringify(inv_trans[i],null,4)+"\n");
                   }// if !found


            } //for - done creating own_rows

             console.log("\nDONE creating own_rows, now inserting...==================\n\n")
             //console.log("\nInvTrans looks like this: "+inv_trans.toString()+"\n\n")
            //now add all own_rows to ownsrhip table

            for (let k=0; k<own_Rows.length; k++) {
                    var insertOwnershipResults = await iraSQL.insertOwnership(own_Rows[k]);
                    console.log("\nAdded new ownership row, id= "+insertOwnershipResults.insertId+" for investor "+own_Rows[k].parent_entity_id+"");

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
          entityWithOwnership.ownership_status = 1;
          console.log("\nWant to update Entity Ownership status for "+JSON.stringify(entityWithOwnership)+"\n");

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
                          let results = calc.totalupInvestors(investors)
                          let expandInvestors = results[0]
                          let totalCapital =  results[1]
                          let totalCapitalPct = (results[2]*1).toFixed(2)



                          console.log("rendering ownership")
                          res.render('deal-ownership', {
                                  userObj: userObj,
                                  message:  "Showing "+expandInvestors.length+" investors ",
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
          var rows = await iraSQL.getTransactionsForInvestment(entity.id, [1,5,6]);
          console.log("\nIn SetOwn - got "+rows.length+" transactions for "+ entity.name+" \n");
                  // screen transaction and calculate ownership
          if(entity.ownership_status===0 && (rows.length >0) ) {
                                var results = calc.calculateOwnership(rows);
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
                                        totalCapital: calc.formatCurrency(totalCapital),
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
                                let results = calc.totalupInvestors(investors)
                                let expandInvestors = results[0]
                                let totalCapital =  results[1]
                                let totalCapitalPct = results[2]
                                let expandDeal = calc.calculateDeal(deals[0])
                                console.log("\nrendering ownership and Deal is "+JSON.stringify(deals))
                                res.render('deal-details', {
                                        userObj: userObj,
                                        message:  "Showing "+expandInvestors.length+" investors",
                                        dealName: expandDeal.name,
                                        investors: expandInvestors,
                                        totalCapital: totalCapital,
                                        totalCapitalPct: totalCapitalPct,
                                        deal:expandDeal
                                });

            } else { //no ownership data
                                let expandDeal = calc.calculateDeal(deals[0])
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
    transaction.amount = calc.parseFormAmountInput(transaction.amount)
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


app.get('/updateentity/:id', (req, res) => {
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
          res.render('update-entity', {
                userObj: userObj,
                message: "Updating Entity: " + entity.id,
                entity: entity,
                postendpoint: '/process_update_entity'
          }); //  render

      } //async function pullDealDetails
}); //route - update deal



app.post('/process_update_entity', urlencodedParser, (req, res) => {

  //call the async function
  updateEntity().catch(err => {
        console.log("Update Entity problem: "+err);
  })

  async function updateEntity() {
            let formEntity = req.body
            let updatedEntity = {
              id:formEntity.id,
              name: formEntity.name,
              taxid: formEntity.taxid,
              ownership_status: formEntity.ownership_status
            }
            console.log("\nUpdated entity, ready to send to SQL  "+JSON.stringify(updatedEntity));

            let updateEntityResults = await iraSQL.updateEntity(updatedEntity);
            console.log( "Updated entity  no.: "+updatedEntity.id);
            req.flash('login', "Updated Entity: "+updatedEntity.id+"  ");
            res.redirect('/entities');

   } //async function
}); //process add-deal route
