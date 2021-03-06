'use strict';

const express = require('express');
const api = express.Router();
const path = require('path');
const fs = require('fs');

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const mysql = require('mysql');
const calc =  require('./ira-calc');
const iraSQL =  require('./ira-model');
const iraApp =  require('../ira');
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

module.exports = api;



//    *********     List of API Calls ***********

// getcapcallswithdetails
// getccdetails
// getcapitalcalls
// getdealfinancials
// getownership
// getdeals
// getalltransactions
// transforentity
// searchentities
// getportfolio


// =============== APIs ===============


api.get('/api/getuserdetails/:uid',  (req, res) => {

    //call the async function
    api_getuserdetails().catch(err => {
          console.log("Get user details problem: "+err);
          res.send({err});
    })

    async function api_getuserdetails() {
          let userDetails =  await iraSQL.getUserDetails(req.params.uid);
          res.send(JSON.stringify(userDetails ,null,4));
      } //async function getdealfinancials
}); //route - cc-details



api.get('/api/getownership/:id',  (req, res) => {

      api_getownership().catch(err => {
            console.log("api_getownership problem: "+err);
            res.send([]);
      })

      async function api_getownership() {
              var investments = await iraSQL.getOwnershipForEntity(req.params.id)
              let invTransactions = investments.slice();
              //build deal details object
              if (investments.length>0) {
                                    let ownResults = calc.totalupInvestors(investments)
                                    console.log("\n all the own Results "+ownResults)
                                    let ownRows = ownResults[0];

                                    //need to wait for all the async calls to be done
                                    let ownRowswithTrans = await Promise.all(
                                               ownRows.map( async (ownRow) =>  {
                                                      ownRow.transactions = await iraSQL.getTransactionsForInvestorAndEntity(ownRow.investor_id, ownRow.investment_id,[1,3,5,6,7,8]);
                                                      //console.log("\n here are the ownrow for "+ownRow.investor_name+"  "+JSON.stringify(ownRow,null,4));
                                                      return ownRow
                                              })
                                    )
                                    ownResults[0] = ownRowswithTrans;

                                   res.send(JSON.stringify(ownResults,null,4));

              } else { //no ownership data
                                   res.send([{err:"No ownership information found"}]);
              }  //if-else  - no ownership get name of entity

      } //async function
}); //route - api get woensrhip







api.get('/api/getportfolio/:entid',  (req, res) => {

    //call the async function
    api_getPortfolio().catch(err => {
          console.log("Get portfolio problem: "+err);
          res.send({err});
    })

    async function api_getPortfolio() {


           let results = await calc.totalupInvestorPortfolio(req.params.entid)
           let portfolioDeals = results[0]
           if (portfolioDeals.length >0 ) {

                   res.send(JSON.stringify(results,null,4));

          } else {
              res.send([]);
          }

    } //async function getPortfolio
}); //route - cc-s








api.get('/api/getinvestors/', (req, res) => {
    console.log("IN API get investors problem: ");

          api_getInvestors().catch(err => {
                console.log("API get investors problem: "+err);
                res.send({err});
          })

      async function api_getInvestors() {

                  var entList = await iraSQL.getEntitiesByTypes([2,4]);
                  if (entList.length <1) {
                              var entList = [{
                                id:0,
                                name: "Not found"
                              }]

                  }

                  res.send(JSON.stringify(entList,null,4));

    }; //async function
}); //route





api.get('/api/getinvestors/', (req, res) => {
    console.log("IN API get investors problem: ");

          api_getInvestors().catch(err => {
                console.log("API get investors problem: "+err);
                res.send({err});
          })

      async function api_getInvestors() {

                  var entList = await iraSQL.getEntitiesByTypes([2,4]);
                  if (invList.length <1) {
                              var entList = [{
                                id:0,
                                name: "Not found"
                              }]

                  }

                  res.send(JSON.stringify(entList,null,3));

    }; //async function
}); //route






//const fetchURL_investors = apiHost+"/api/getentitiesbytypes?params={%22types%22:[2,4]}"
api.get('/api/getentitiesbytypes/',  (req, res) => {

    //call the async function
    api_getentitiesbytypes().catch(err => {
          console.log("Get entities by types problem: "+err);
          res.send({err});
    })

    async function api_getentitiesbytypes() {
          //http://localhost:8081/api/getentitiesbytypes?params={%22types%22:[1,2,3]}

          let getParams = req.query.params
          //console.log("Here is GET ?params string:   "+getParams);
          let tryArray = JSON.parse(getParams).types
          //console.log("Here is tryArray   "+tryArray);
          //console.log("Tryarray is of type  "+(typeof tryArray));
          let typesArray = tryArray
          let entitiesToPick = await iraSQL.getEntitiesByTypes(typesArray);
          entitiesToPick.forEach(item => item.name = item.name.substring(0,21));
          res.send(JSON.stringify(entitiesToPick, null,4));
      } //async function getcentitiesbytypes


}); //route - api - getcentitiesbytypes




   api.get('/api/gettransactiontypes',  (req, res) => {

         console.log("IN API get TT ");
       //call the async function
       api_gettransactiontypes().catch(err => {
             console.log("Get transaction types problem: "+err);
             res.send({err});
       })

       async function api_gettransactiontypes() {
             let transactionTypesToPick =  await iraSQL.getTransactionTypes();
             //remove Capital Call for now
             //transactionTypesToPick.splice(6,1)
             console.log("IN API get TT ");
             res.send(JSON.stringify(transactionTypesToPick, null,4));
         } //async function getdealfinancials
   }); //route - cc-details





// for each CC ID it returns
//return [{foundCapCall}, capCallTransactions[], {dealEntity}, totalRaised]
api.get('/api/getcapcallswithdetails/:entid',  (req, res) => {

    //call the async function
    api_getcapitalcalls().catch(err => {
          console.log("Get capital calls problem: "+err);
          res.send({err});
    })

    async function api_getcapitalcalls() {
          let capitalCalls =  await iraSQL.getCapitalCallsForEntity(req.params.entid);
          console.log("IN getCapCallswithDetails found "+capitalCalls.length+" capital calls  " + JSON.stringify(capitalCalls, null, 4));

          if (capitalCalls.length>0) {

                let capcallsWithDetails = []
                for (let i=0;i<capitalCalls.length; i++) {
                      capcallsWithDetails[i] = await calc.getCapCallDetails(capitalCalls[i].id)
                }

              res.send(JSON.stringify(capcallsWithDetails ,null,4));

          } else {
              res.send([]);
          }



    } //async function getdealfinancials
}); //route - cc-s




// it returns:
//return [foundCapCall, capCallTransactions, dealEntity, totalRaised]

api.get('/api/getccdetails/:ccid',  (req, res) => {

    //call the async function
    api_getccdetails().catch(err => {
          console.log("Get capital calls problem: "+err);
          res.send({err});
    })

    async function api_getccdetails() {
          let ccDetails =  await calc.getCapCallDetails(req.params.ccid);
          res.send(JSON.stringify(ccDetails ,null,4));
      } //async function getdealfinancials
}); //route - cc-details



api.get('/api/getcapitalcalls/:entid',  (req, res) => {

    //call the async function
    api_getcapitalcalls().catch(err => {
          console.log("Get capital calls problem: "+err);
          res.send({err});
    })

    async function api_getcapitalcalls() {
          let targetEnt = req.params.id ? req.params.id :0
          console.log("TargetEnt "+targetEnt);
          let capitalCalls =  await iraSQL.getCapitalCallsForEntity(targetEnt);
          let capCallsName = capitalCalls.map(cc => {
                    cc.name = cc.cc_name
                    return cc
          })

          res.send(JSON.stringify(capCallsName,null,3));
      } //async function getdealfinancials
}); //route - cc-s


api.get('/api/getcapitalcalls', (req, res) => {
          console.log("No ent for cap call ");
          res.redirect("/api/getcapitalcalls/0");
}); //route





api.get('/api/getdealfinancials/:id',  (req, res) => {

    //call the async function
    api_getdealfinancials().catch(err => {
          console.log("GDF problem: "+err);
          res.send({err});
    })

    async function api_getdealfinancials() {
          var entity = await iraSQL.getEntityById(req.params.id);
          let expandDeal = calc.calculateDeal(await iraSQL.getDealById(entity.deal_id))
          res.send(JSON.stringify(expandDeal,null,3));
      } //async function getdealfinancials
}); //route - deal details







api.get('/api/getdeals/', (req, res, next) => {
          api_searchEntities().catch(err => {
                console.log("API search Entity problem: "+err);
                res.send({err});
          })

      async function api_searchEntities() {


                  var entList = await iraSQL.getEntitiesByTypes([1]);
                  if (entList.length <1) {
                              var entList = [{
                                id:0,
                                name: "Not found"
                              }]

                  }

                  res.send(JSON.stringify(entList,null,3));

    }; //async function
}); //route





api.get('/api/searchentities/:term', (req, res, next) => {
          api_searchEntities().catch(err => {
                console.log("API search Entity problem: "+err);
                res.send({err});
          })

      async function api_searchEntities() {

                  var entList = await iraSQL.searchEntities (req.params.term);
                  if (entList.length <1) {
                              var entList = [{
                                id:0,
                                name: "No Matches found"
                              }]

                  }

                  var entitiesForFilter = entList.map(function(plank) {
                              plank.name = plank.name.substring(0,35);
                              return plank;
                  });

                  console.log("\nGot entities: "+JSON.stringify(entitiesForFilter,null,5));

                  res.send(JSON.stringify(entitiesForFilter,null,3));

    }; //async function

}); //route

api.get('/api/searchentities/', (req, res, next) => {
          res.send("[]");
}); //route



api.get('/api/transforentity/:id', (req, res) => {

          api_transactionsForEntity().catch(err => {
                console.log("API trans for Entity problem: "+err);
                res.send({err});
          })

          async function api_transactionsForEntity() {
                  let entity_id = req.params.id
                  console.log("have Entity_id   "+ entity_id )
                  let transactions = []
                  if (entity_id <1) {
                        console.log("giving back all" )
                        transactions = await iraSQL.getAllTransactions();

                  } else {
                        let entity = await iraSQL.getEntityById(req.params.id);
                        transactions = await iraSQL.getTransactionsForInvestment(entity.id);
                        //console.log("\nGot transactions for entity  "+JSON.stringify(transactions,null,5));
                  }

                  res.send(JSON.stringify(transactions,null,3));

    }; //async function

}); //route


api.get('/api/getalltransactions', (req, res) => {

          api_getalltransactions().catch(err => {
                console.log("API all transactions problem: "+err);
                res.send({err});
          })

          async function api_getalltransactions() {
                  var transactions = await iraSQL.getAllTransactions();
                  res.send(JSON.stringify(transactions,null,3));


    }; //async function

}); //route
