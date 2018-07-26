'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const mysql = require('mysql');
const calc =  require('./ira-calc');
const iraSQL =  require('./ira-model');
const iraApp =  require('./ira');
const passport  = require('passport');
const winston = require('winston')



//default session info
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

module.exports = router;


//============ FUNCTIONS ======================



//==========  ROUTES ===========================


router.get('/dealdetails/:id', checkAuthentication, (req, res) => {



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

          let capitalCalls =  await iraSQL.getCapitalCallsForEntity(entity.id);
          console.log("Got bacck Capital Calls "+JSON.stringify(capitalCalls, null, 4))

          var deals = await iraSQL.getDealById(entity.deal_id);
          console.log("Before Ownership, have Entity   "+ entity.name+"   and Deal is  "+JSON.stringify(deals));
          var investors = await iraSQL.getOwnershipForEntity(entity.id)
          if (investors.length>0) {
                                let results = calc.totalupInvestors(investors)
                                let expandInvestors = results[0]
                                let totalCapital =  results[1]
                                let totalCapitalPct = results[2]
                                let expandDeal = calc.calculateDeal(deals[0])
                                // console.log("\nrendering ownership and Deal is "+JSON.stringify(deals, null, 4))
                                res.render('deal-details', {
                                        userObj: userObj,
                                        message:  "Showing "+expandInvestors.length+" investors",
                                        investors: expandInvestors,
                                        capitalCalls: capitalCalls,
                                        totalCapital: totalCapital,
                                        totalCapitalPct: totalCapitalPct,
                                        deal:expandDeal,
                                        entity:entity
                                });

            } else { //no ownership data
                                let expandDeal = calc.calculateDeal(deals[0])
                                res.render('deal-details', {
                                      userObj: userObj,
                                      message:  "No ownership information found ",
                                      dealName: expandDeal.name,
                                      deal:expandDeal,
                                      capitalCalls: capitalCalls
                                }); //  render
            }  //if-else  - no ownership get name of entity
      } //async function pullDealComponents
}); //route - deal details







//pull up info for this one capital call
router.get('/capitalcall/:id', checkAuthentication, (req, res) => {
      if (req.session && req.session.passport) {
         userObj = req.session.passport.user;
       }

       showCapCallDetails().catch(err => {
             console.log("cap call details problem: "+err);
             req.flash('login', "Problems getting Capital Call for "+req.params.id+".  ")
             res.redirect('/home')
       })

       async function showCapCallDetails() {
             let foundCapCall = await iraSQL.getCapitalCallById(req.params.id);
             console.log("in CC Details, have CC   "+ JSON.stringify(foundCapCall));
             foundCapCall.formatted_target_amount = calc.formatCurrency(foundCapCall.target_amount);
             foundCapCall.formatted_target_per_investor = calc.formatCurrency(foundCapCall.target_per_investor);

            let capCallTransactions = await iraSQL.getTransactionsForCapitalCall (foundCapCall.id, [8]);
            console.log("Capp Call transactions are: "+JSON.stringify(capCallTransactions,null,4))

            let dealEntity = await iraSQL.getEntityById(foundCapCall.deal_entity_id);

            let totalRaised = 0
            let formattedCapCallTransaction = capCallTransactions.map((trans) => {
                        trans.formatted_amount = calc.formatCurrency(trans.t_amount);
                        totalRaised += trans.t_amount;
                        return trans
            })



                            console.log("rendering Cap Call")
                            res.render('capitalcall-details', {
                                    userObj: userObj,
                                    message:  "Showing "+capCallTransactions.length+" transactions. ",
                                    capCall: foundCapCall,
                                    dealEntity: dealEntity,
                                    transactions: formattedCapCallTransaction,
                                    totalRaised: calc.formatCurrency(totalRaised)

                            });


       } //async function
  }); //route - ownership







router.get('/portfolio/:id', (req, res) => {
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
              let results = await calc.totalupInvestorPortfolio(foundInvestor.id)
              let portfolioDeals = results[0]
              if (portfolioDeals.length >0 ) {
                          let totalInvestmentValue =  results[1]
                          let totalPortfolioValue =  results[2]
                          let totalDistributions =  results[3]*-1 //make it positive here
                          let portfolioValueGain =  totalPortfolioValue-totalInvestmentValue
                          let portfolioCashGain = portfolioValueGain+ totalDistributions
                          let portfolioIRR = parseFloat(portfolioCashGain/totalInvestmentValue)*100
                          console.log("\nRendering Investor Portfolio, totalDistrib is  : " + totalDistributions+"")
                          console.log("\nexample 2nd Deal : " + JSON.stringify(portfolioDeals[1],null,6)+"\n\n")
                          iraApp.logger.log('info', '/portfolio/id    : '+foundInvestor.name+"  U:"+userObj.email);
                          res.render('portfolio-details', {
                                  userObj: userObj,
                                  message:  "Showing "+portfolioDeals.length+" investments ",
                                  investorName: portfolioDeals[0].investor_name,
                                  investments: portfolioDeals, //including rollover transactions
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



router.get('/showlogs',  (req, res) => {
        if (req.session && req.session.passport) {
           userObj = req.session.passport.user;
        }

        asyncShowFile().catch(err => {
               console.log("readFile problem: "+err);
               req.flash('login', "Problems getting file : "+filePath+".  ")
               res.redirect('/home')
         })


        async function asyncShowFile() {
              let fileName = "iralog2.log"
              let filePath = path.resolve(__dirname, fileName)
              console.log("FilePath is : "+filePath )

              try {
                        let fileContent = await fs.readFileSync(filePath, 'utf8')
                        //console.log("Got from file: "+fileContent)
                        var logRows = []

                        while (fileContent.length > 2) {
                          let startLine = fileContent.indexOf("<*");
                          let endLine = fileContent.indexOf("*>");
                          let logLine = fileContent.slice(startLine, endLine+2);
                          //console.log("line is:  "+logLine)
                          let user = logLine.slice(logLine.indexOf("U:")+2,logLine.indexOf("*>"))
                          let message = logLine.slice(logLine.indexOf("Z ")+2,logLine.indexOf("U:")-1)
                          //let dateTime = logLine.slice(2,logLine.indexOf("Z")
                          let dateTime = (logLine.slice(2,logLine.indexOf("Z")-4)).replace(/T/," ")
                          // message = message.replace(/(?<=7)T/g,"  "); //JS does not support look behind!!

                          let logRow = {
                                  user:user,
                                  message:message,
                                  time:dateTime
                          }
                          logRows.push(logRow)
                          //trim the row you just got
                          fileContent = fileContent.slice(endLine+2)
                        }

                        res.render('show-logs', {
                                userObj: userObj,
                                sessioninfo: req.session,
                                message: req.flash('login') + " ",
                                logFilename: fileName,
                                logRows:logRows

                        });//render

              } catch (err){
                        console.log(err+ " -- File   ");
                        req.flash('login', "Could not read log file "+ filePath +" with err"+err);
                        res.redirect('/home/');
             } //trycatch
        } //asyncfunction
}); //route showlogs





router.get('/download_csv/:id', (req, res) => {
      downloadCSVTransactions().catch(err => {
            console.log("DownloadTransactions problem: "+err);
      })
      let fileName = "file";
      async function downloadCSVTransactions() {
            try {
                  var entity = await iraSQL.getEntityById(req.params.id);
                  //console.log("have Entity   "+ JSON.stringify(entity));
                  var transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                  console.log("\nGot transactions for entity  "+JSON.stringify(transactions,null,5));
                  fileName = entity.name+"_IRA_Transactions.csv"

            } catch (err ){
                  //console.log(err+ " -- No entity for    "+ req.params.id);
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
                  //console.log("In ira, the CSV file is \n"+transCSV+"\n")

                  res.setHeader('Content-disposition', 'attachment; filename='+fileName);
                  res.set('Content-Type', 'text/csv');
                  res.status(200).send(transCSV);

    }; //async function

}); //route








  router.get('/transactions/:id', checkAuthentication, (req, res) => {
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
                  iraApp.logger.log('info', '/transactions/id : '+entity.name+"  U:"+userObj.email);
                  var transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                  console.log("\nGot transactions for entity, here is 1st  "+JSON.stringify(transactions[0],null,5));

                  //add delete flag to each
                  for (let j=0; j<transactions.length; j++) {

                              transactions[j].formatted_amount = calc.formatCurrency(transactions[j].t_amount);
                              let hasOwnTrans = await iraSQL.getOwnTransByTransID(transactions[j].id);
                              transactions[j].can_delete = (hasOwnTrans ? false : true);
                              //console.log ("for "+transactions[j].id+" can delete is: "+transactions[j].can_delete)

                  };

            } catch (err ){
                  console.log(err+ " -- No entity for    "+ req.params.id);
                  var transactions = await iraSQL.getAllTransactions();

                  for (let j=0; j<transactions.length; j++) {
                              transactions[j].formatted_amount = calc.formatCurrency(transactions[j].t_amount);
                              transactions[j].can_delete = false;
                               //return e;
                  };

                  var entity = {
                    id:0,
                    name: "Select filter"
                  }
            }




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
                    transactions: transactions,
                    filterList: entitiesForFilter,
                    selectedEntity: entity,
                    postendpoint: '/process_transactions_filter'
            });//render

      } //async function
  }); //route - transactions





  //need this because we hit a submit button to send search
  router.post('/process_transactions_filter', urlencodedParser, (req, res) => {

            if (req.session && req.session.passport) {
               userObj = req.session.passport.user;
             }

             let filterEntity = req.body.filter_ent
             console.log("\nGot Filter entity"+filterEntity)
             res.redirect('/transactions/'+filterEntity);

  })






//MENU - list of entities and theor Ownership status
  router.get('/setownership', checkAuthentication, (req, res) => {
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


//show existing ownership
router.get('/ownership/:id', checkAuthentication, (req, res) => {
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
                            res.render('entity-details', {
                                    userObj: userObj,
                                    message:  "Showing "+expandInvestors.length+" investors ",
                                    entity: foundEntity,
                                    impliedValue: calc.formatCurrency(foundEntity.implied_value),
                                    investors: expandInvestors,
                                    totalCapital: totalCapital,
                                    totalCapitalPct: totalCapitalPct
                            });

                      } else { //no ownership data
                            res.redirect('/setownership/'+req.params.id)

                  } //if ownership
       } //async function
  }); //route - ownership






//===========TOP LEVEL MENUS =============================

router.get('/entities', checkAuthentication, (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;

           }
          iraSQL.getAllEntities().then(
                function(entities) {
                          console.log("in get all ENTITIES #6  "+JSON.stringify(entities[5], null, 4))

                          var expandEntities = entities.map((ent) => {
                                      ent.formatted_implied_value = calc.formatCurrency(ent.implied_value);
                                      ent.short_name = ent.name.substring(0,30);
                                      return ent
                          });



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


router.get('/investors', checkAuthentication, (req, res) => {
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





router.get('/deals', checkAuthentication, (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;
             console.log("Session info is: "+JSON.stringify(req.session,null,4));
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






router.get('/transactions/', (req, res) => {
   res.redirect('/transactions/000');
});


router.get('/commitments', checkAuthentication, (req, res) => {
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
      reportMenuOptions[0] = {name:"All Entities", link:"/entities"}
      reportMenuOptions[1] = {name:"Transactions with Filter", link:"/transactions"}
      reportMenuOptions[2] = {name:"Investors", link:"/investors"}
      reportMenuOptions[3] = {name:"Deals", link:"/deals"}
      //reportMenuOptions[2] = {name:"Commitments", link:"/commitments"}




      let adminMenuOptions = []
      adminMenuOptions[0] = {name:"Manage Ownership", link:"/setownership/"}
      adminMenuOptions[1] = {name:"New Transaction", link:"/add-transaction"}
      adminMenuOptions[2] = {name:"New Capital-Call Transaction", link:"/add-capital-call-transaction"}
      adminMenuOptions[3] = {name:"New Entity", link:"/add-entity"}
      adminMenuOptions[4] = {name:"New Deal", link:"/add-deal"}




      res.render('home', {
              userObj: userObj,
              message: req.flash('login'),
              sessionInfo: JSON.stringify(req.session),
              reportmenuoptions: reportMenuOptions,
              adminmenuoptions: adminMenuOptions,
              iraVersion: iraApp.version
      });

  });

  router.get('/shutdown123', (req, res) => {
          shutDownServer()
          res.send("Good--bye!")
  })



  router.get('/', function(req, res) {
        res.redirect('/home')

 })



 //NOT FIRST TIME LOGIN - Repeat of checkAuthentication from app.js
 function checkAuthentication(req,res,next){

   try {
           if (userObj.id == 0) {
                req.session.return_to = "/";
           } else {
                req.session.return_to = req.url;
           }

           if(req.isAuthenticated()){
                  console.log("YES, authenticated"+req.url)
                  //req.flash('login', 'checkAuth success')
                  return next();
                  //res.redirect(req.url);

           } else {
               console.log("NO, not authenticated"+req.url)
               //req.flash('login', 'checkAuth failed, need to login')
               res.redirect("/login");
           }

     } catch (err){
               console.log(err+ " -- Login   ");
               req.flash('login', "Could not find user with err"+err);
               res.redirect('/home/');
    } //trycatch


 } //function
