'use strict';


const calc =  require('./src/ira-calc');
const iraSQL =  require('./src/ira-model');
const menus = require('./src/ira-menus');
const api = require('./src/ira-api');
const deployConfig = require('./src/ira-config');

const path = require('path');
const fs = require('fs');
const vm = require('vm')
const express = require('express');
const app = express();
const nconf = require('nconf');
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const flash             = require('connect-flash-plus');

//const crypto            = require('crypto');
//const bcrypt = require('bcrypt');

const passport          = require('passport');
const LocalStrategy     = require('passport-local').Strategy;
const cookieParser = require('cookie-parser')
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const secret = "cat"
const winston = require('winston')
const nodePort = 8081;

const iraVersion = "0.19.8  +Currency refactor +API capital calls"


//tried byt failed to save winston logs into the DB
//const winston_mysql = require('winston-mysql')

// var winstonSQL_options = {
//   host     : deployConfig.get('DEV_ENDPOINT'),
//   user     : deployConfig.get('DEV_USER'),
//   password : deployConfig.get('DEV_USER'),
//   database : deployConfig.get('DEV_DBNAME'),
//   table    : 'activitylog'
// };



// var iraLogger = new (winston.Logger)({
// transports: [
//   new winston_mysql(options_default)
// ]
// });



let iraLogger = winston.createLogger({
    level: 'info',  //or get from config.json
    format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(info => {
            return `<*${info.timestamp} ${info.level}: ${info.message}*>`;
        })
    ),
    transports: [
             new winston.transports.Console(),
             //new winston_mysql(winstonSQL_options),
 		         new winston.transports.File({ filename: 'iralog2.log' })
       ]

    //    ,
    // exceptionHandlers: [
    // 		    new winston.transports.File({ filename: 'iralog.log' })
    //   ]
}); // iraLogger

iraLogger.exceptions.handle(
  //new winston.transports.File({ filename: 'iralog2.log' }),
  new winston.transports.Console()
);







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
app.use(passport.authenticate('session'));


// consider adding alogger
//app.use(express.logger('dev'));

//to allow API access from React
app.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
});
app.set('trust proxy', true);


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

  app.use(flash());
//routes last
  app.use(menus) //for extra routing
  app.use(api)

// ========START THE SERVER ==============================

const server = app.listen(nodePort, function() {
  console.log('IRA listening on port  ' + nodePort);
  console.log('winston logging IRA on level = ' + iraLogger.level)
});


module.exports = app;
exports.version = iraVersion;
exports.logger = iraLogger;


//const XMLHttpRequest = require('xhr2');
//var xhr = new XMLHttpRequest();

//============ ROUTES  ======================




//add CC trans - nothing selected
app.get('/add-capital-call-transaction', (req, res) => {

        if (req.session && req.session.passport) {
           userObj = req.session.passport.user;
        }


addCapitalCallTrans().catch(err => {
               console.log("Add CapCall Transacaton Problem problem: "+err);
               req.flash('login', "Problems adding Capcall Transaction ")
               res.redirect('/home')
         })


  async function addCapitalCallTrans() {

      let capitalCalls =  await iraSQL.getCapitalCallsForEntity();
      console.log("Got bacck Capital Calls "+JSON.stringify(capitalCalls, null, 4))
      // let dealsToPick  = deals.map(function(plank) {
      //         plank.name = plank.name.substring(0,30);
      //         return plank;
      // });

      res.render('add-capital-call-trans', {
                userObj: userObj,
                postendpoint: '/process_add_capital_call_trans',
                phase: 1,
                capitalcalls: capitalCalls

        });//render
  } //async function
}); //route add capital call





// capital call trans - Cap call selected - gp to phase 2
app.get('/add_capital_call_trans/:ccid', (req, res) => {
    //call the async function
    processNewCapCallID().catch(err => {
          console.log("Process Add Capital Call Transaction ID problem: "+err);
    })

    async function processNewCapCallID() {
                    let cc_id = req.params.ccid;
                    let capCallObj = await iraSQL.getCapitalCallById(cc_id);
                    let deal_entity_id = capCallObj.deal_entity_id;
                    let investors =  await iraSQL.getUniqueOwnershipForEntity(deal_entity_id);


                    capCallObj.formatted_target_amount = calc.formatCurrency(capCallObj.target_amount);
                    capCallObj.formatted_target_per_investor = calc.formatCurrency(capCallObj.target_per_investor);


                    //transform ownership rows into investor rows
                    console.log("In processCapCall-CCID, got "+investors.length+ " investors: "+JSON.stringify(investors,null,4)+"\n");

                    res.render('add-capital-call-trans', {
                              userObj: userObj,
                              postendpoint: '/process_add_capital_call_trans',
                              phase: 2,
                              investors: investors,
                              capCall: capCallObj,
                              deal_name:investors[0].investment_name
                      });//render

     } //async function
  }); //process add-deal route





// insert the new transaction
app.post('/process_add_capital_call_trans', urlencodedParser, (req, res) => {
    //call the async function
    processNewCapCall().catch(err => {
          console.log("Process Add Capital Call Transaction problem: "+err);
    })

    async function processNewCapCall() {
              let formCapCallTrans = req.body
              console.log("Back from the CapCall FORM "+JSON.stringify(formCapCallTrans, null, 4))
              //you just have te id of the capCall - you should have capCall.entity_id

              if (formCapCallTrans.phase === "1") {
                    //console.log("Back from the CapCall FORM "+JSON.stringify(formCapCallTrans, null, 4))
                    // console.log("ARRAY is = "+formCapCallTrans.choiceA+"\n")
                    // console.log("Array as JSON  "+JSON.parse(formCapCallTrans.choiceA))
                    // console.log("2nd element in Array as JSON  "+JSON.parse(formCapCallTrans.choiceA)[1])
                    let cc_id = JSON.parse(formCapCallTrans.choiceA)[0];
                    let capCallObj = await iraSQL.getCapitalCallById(cc_id);
                    let deal_entity_id = JSON.parse(formCapCallTrans.choiceA)[1];
                    //let cc_name = JSON.parse(formCapCallTrans.choiceA)[2];
                    let investors =  await iraSQL.getUniqueOwnershipForEntity(deal_entity_id);
                    let per_investor = calc.formatCurrency(capCallObj.target_amount/investors.length)

                    //transform ownership rows into investor rows
                    console.log("In processCapCall, got "+investors.length+ " investors: "+JSON.stringify(investors,null,4)+"\n");


                    capCallObj.formatted_target_amount = calc.formatCurrency(capCallObj.target_amount);
                    capCallObj.formatted_target_per_investor = calc.formatCurrency(capCallObj.target_per_investor);

                    res.render('add-capital-call-trans', {
                              userObj: userObj,
                              postendpoint: '/process_add_capital_call_trans',
                              phase: 2,
                              investors: investors,
                              capCall: capCallObj,
                              per_investor: per_investor,
                              deal_name:investors[0].investment_name
                      });//render

            } else {  //phase = 2
                      let capCallObj = await iraSQL.getCapitalCallById(formCapCallTrans.cc_id);
                      console.log("In processCapCall- Phase 2, got "+JSON.stringify(capCallObj,null,4)+"\n");


                      let newTransaction = {
                                investor_entity_id: formCapCallTrans.investor_entity_id,
                                //investment_entity_id: capCallObj.deal_entity_id,
                                investment_entity_id: formCapCallTrans.investment_entity_id,
                                passthru_entity_id: null,
                                amount: calc.parseFormAmountInput(formCapCallTrans.amount),
                                wired_date: formCapCallTrans.wired_date,
                                own_adj:0.00,
                                trans_type:8,
                                notes: "for CapCall: " + capCallObj.cc_name + ".  " + formCapCallTrans.notes,
                                capital_call_id: formCapCallTrans.cc_id
                        }


              console.log("\nAbout to insert new Cap Call transaction with "+JSON.stringify(newTransaction, null, 4)+"\n");

              let insertTransResults = await iraSQL.insertTransaction(newTransaction);
              iraLogger.log('info', '/add-capital-call-transaction : '+insertTransResults.insertId+" U:"+userObj.email);
              req.flash('login', "Added capital-call transaction no. "+insertTransResults.insertId);
              console.log("\nAdded CapCall transaction no. "+insertTransResults.insertId);
              res.redirect('/home');
          }


     } //async function
  }); //process add-deal route








//add cap call for a specific entity - link off deal page
app.get('/add-capital-call/:id', (req, res) => {
        if (req.session && req.session.passport) {
           userObj = req.session.passport.user;
        }


  addCapitalCall().catch(err => {
               console.log("Add CapCall Problem problem: "+err);
               req.flash('login', "Problems adding Capcall ")
               res.redirect('/home')
         })


  async function addCapitalCall() {
      // let deals = await iraSQL.getEntitiesByTypes([1]);
      //
      // let dealsToPick  = deals.map(function(plank) {
      //         plank.name = plank.name.substring(0,30);
      //         return plank;
      // });


      let dealEntity = await iraSQL.getEntityById(req.params.id)
      console.log("\ngot DealEntity... "+JSON.stringify(dealEntity,null,4));
      res.render('add-capital-call', {
                userObj: userObj,
                postendpoint: '/process_add_capital_call',
                dealEntity: dealEntity
        });//render
  } //async function
}); //route add capital call



// insert the new transaction
app.post('/process_add_capital_call', urlencodedParser, (req, res) => {

    //call the async function
    processNewCapCall().catch(err => {
          console.log("Process Add Capital Call problem: "+err);
    })

    async function processNewCapCall() {

              let readyCapCall = req.body;
              readyCapCall.target_amount = calc.parseFormAmountInput(readyCapCall.target_amount)
              let deal_entity_id = readyCapCall.deal_entity_id;
              let investors =  await iraSQL.getUniqueOwnershipForEntity(deal_entity_id);
              readyCapCall.target_per_investor = readyCapCall.target_amount/investors.length;
              console.log("Ready to add new Capital Call : "+JSON.stringify(readyCapCall, null,4));
              //readyCapCall.target_amount = parseFloat(calc.parseFormAmountInput(readyCapCall.target_amount)).toFixed(2)
              let insertCapCallResults = await iraSQL.insertCapitalCall(readyCapCall);
              console.log( "Added CapCall #: "+insertCapCallResults.insertId);
              req.flash('login', "Added Capital Call no. "+insertCapCallResults.insertId+"  ");
              res.redirect('/add_capital_call_trans/'+insertCapCallResults.insertId);

     } //async function
  }); //process add-deal route






app.get('/add-transaction', checkAuthentication, (req, res) => {
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
                        //remove Capital Call for now
                        transactionTypesToPick.splice(6,1)
              }, function(error) {   //failed
                        console.log("Getting deals problem: "+error);
                        return;
              } //try-catch
           );


        //deals

        iraSQL.getEntitiesByTypes([1,3,4]).then(
              async function(entities) {
                    dealsToPick  = entities.map(function(plank) {
                            plank.name = plank.name.substring(0,30);
                            return plank;
                });


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

                  var investorsToPick   = entities.map(function(plank) {
                              plank.name = plank.name.substring(0,30);
                              return plank;
                  });

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
            //iraLogger.log('info', '/add-transaction : '+savedData.insertId+":"+transaction.investor_entity_id+":"+transaction.investment_entity_id+":"+transaction.trans_type+":"+transaction.amount+" U:"+userObj.email);
            iraLogger.log('info', '/add-transaction : '+savedData.insertId+" U:"+userObj.email);

            res.redirect('/transactions');
          }, function(error) {   //failed
               console.log("Process_add_transaction problem: "+error);
               return;
          }
    ); //try-catch
}); //route



app.get('/deletetransaction/:id', checkAuthentication, (req, res) => {
    if (req.session && req.session.passport) {
       userObj = req.session.passport.user;
     }

    deleteTransaction().catch(err => {
           console.log("Delete Transactions problem: "+err);
           req.flash('login', "Problems deleting transaction Num: "+req.params.id+".  ")
           res.redirect('/home')
     })

    async function deleteTransaction() {
       let foundTransaction = []
       //lets first see if this transaction exists
          try {
                foundTransaction = await iraSQL.getTransactionById(req.params.id);
                console.log("Found Transaction and it is "+JSON.stringify(foundTransaction,null,4));

              } catch (err){
                    console.log(err+ " -- No transactions for    "+ req.params.term);
                    req.flash('login', "No transactions for    "+ req.params.term+".  ");
                    res.redirect('/home/');
              }

              //Is this transaction part of Ownership
              let foundOwnTrans = await iraSQL.getOwnTransByTransID(foundTransaction[0].id);
              if (foundOwnTrans) {
                        console.log("NO GO on Delete - In /deleteTransaction, got own_trans row: "+JSON.stringify(foundOwnTrans,null,4)+"\n\n");
                        req.flash('login', "Cannot delete transaction "+foundTransaction[0].id+" as it has ownership dependencies. Please clear ownership and try again.");
                        res.redirect('/transactions/');

              } else {
                        console.log(" No Own-Trans - OK to delete ");
                        let results = await iraSQL.deleteTransaction(foundTransaction[0].id);
                        console.log("Deleted transaction - ffectedRows "+results.affectedRows+"\n");
                        //  //+"results : "+JSON.stringify(results,null,6)+"\n");
                        req.flash('login', "Deleted transaction"+foundTransaction[0].id+".  ");
                        res.redirect('/transactions/');
              } //if results

   } //async function
}) //route


// pulls together Ownesrhip information for a deal or Entity to be shown & approved by User
app.get('/setownership/:id', checkAuthentication, (req, res) => {

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
          var rows = await iraSQL.getTransactionsForInvestment(entity.id, [1,5,6,7]);
          console.log("\nIn SetOwn - got "+rows.length+" transactions for "+ entity.name+" \n");
                  // screen transaction and calculate ownership
          if(entity.ownership_status===0 && (rows.length >0) ) {
                            // do we adjust own.adjutment here? should already be in the ownership rows
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
                                        totalCapital: totalCapital,
                                        totalAdjOwnPct: ((totalAdjOwnPct*10000)/10000).toFixed(4),
                                        totalOwnPct: Math.round((totalOwnPct*1000)/1000).toFixed(4),
                                        postendpoint: '/process_set_ownership'

                                });
           } else {
            req.flash('login', "No ownership info or transactions found for "+entity.name);
            res.redirect('/home');


      }  //if-else ownership status
   } //async function pullDealComponents
}); //route - deal details



app.post('/process_set_ownership', urlencodedParser, (req, res) => {
  //call the async function
  insertOwnershipAndUpdateEntity().catch(err => {
        console.log("Insert Ownership problem: "+err);
  })

  async function insertOwnershipAndUpdateEntity() {
            let tempFormTransIds = req.body.trans_ids
            let tempFormPercents = req.body.percents
            let formTransIds = []
            let formPercents = []
            let ownEntityId = 0

            //THE PROBLEM - when there is only ONE transaction to consider, its not an array.
            //If there is only one element, it treats the first element as a STRING!!!
            // so formTransIds[i] will be the first digit in the string

            //if there is only one, and its not an array, force it into an array
            if (!Array.isArray(tempFormTransIds)) {
                    formTransIds[0] = tempFormTransIds
                    formPercents[0] = tempFormPercents
            } else {
                    formTransIds = tempFormTransIds
                    formPercents = tempFormPercents
            }

            console.log("POST from SetOwnership form we got body "+JSON.stringify(req.body)+"");
            console.log("POST from SetOwnership formTransIds"+JSON.stringify(formTransIds)+"");
            console.log("POST from SetOwnership NUMBER of formTransIds is "+formTransIds.length+"");
            console.log("POST from SetOwnership percents"+JSON.stringify(formPercents)+"\n");

            // Now, go throuugh each transactoon
            // see if its the same investor as an existing ownership rows
            // if same investor, merge them
            // new investor, add a new ownRow

            let inv_trans = []
            let own_Rows = []
            for (let i=0;i<formTransIds.length;i++) {
                    let transId = parseInt(formTransIds[i]);
                    console.log("====START Trans #"+i+" =======\nTransaction ID="+transId+"")
                    let transPercent = (formPercents[i]*100).toFixed(4);
                    let trans = await iraSQL.getTransactionById(transId) //basic info
                    console.log("Transcation came back ="+JSON.stringify(trans,null,4)+"\n")
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


                    let trans_amount_to_add = (inv_trans[i].tt_id !=7)
                    //here, check existing ownership rows
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


          let entityWithOwnership =  await iraSQL.getEntityById(ownEntityId)
          //change entity status
          entityWithOwnership.ownership_status = 1;

          //fingure out new Entity EV
          let newImpliedValue = 0
          if (entityWithOwnership.type != 1) { //not a deal get it from Portfolio
                   let results = await calc.calcInvEntityImpliedValue(ownEntityId);
                   newImpliedValue = results[0];
          } else {   //its a deal, get it from Equity Value
                  var dealFinancials = await iraSQL.getDealById(entityWithOwnership.deal_id);
                  newImpliedValue = Number(dealFinancials.aggregate_value)+Number(dealFinancials.cash_assets)-Number(dealFinancials.deal_debt)-Number(dealFinancials.aggregate_debt);
                  console.log("---getting EV from a deal, got "+newImpliedValue+"and Deal "+JSON.stringify(dealFinancials,null,4));
          }
          entityWithOwnership.implied_value = newImpliedValue;
          iraLogger.log('info', '/set-ownership   : '+entityWithOwnership.name+":"+calc.formatCurrency(entityWithOwnership.implied_value)+" U:"+userObj.email);
          console.log("\nUpdating Entity with implied_value and new Ownership status for "+JSON.stringify(entityWithOwnership)+"\n");
          var updateEntityResults = await iraSQL.updateEntity(entityWithOwnership);
          console.log("\nUpdated Ownership Status, here results: "+updateEntityResults+"\n\n")

          //let outputLog = [{entry: "EV is "+newImpliedValue}]

          let outputLog = await calc.updateValueofInvestorsUpstream (ownEntityId);
          //console.log("Output Log on catch side is: "+outputLog.toString()+"\n")
          res.render('show-results', {
                userObj: userObj,
                message: "Set Ownership Transaction",
                entity: entityWithOwnership,
                logEntries: outputLog
          }); //  render


    } //async function
  }) //route



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




app.get('/updatedeal/:id', checkAuthentication, (req, res) => {

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

          let expandDeal = calc.calculateDeal(deals)
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
        console.log("Process Update Deal problem: "+err);
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
            console.log("UPDATE DEAL: \n   ready to send to SQL  "+JSON.stringify(updatedDeal));

            let updateDealResults = await iraSQL.updateDeal(updatedDeal);
            console.log( "Updated deal  no.: "+updatedDeal.id);
            req.flash('login', "UpdatedDeal: "+updatedDeal.id);

            let oldDealEntity = await iraSQL.getEntityByDealId(updatedDeal.id);
            let equity_value = Number(updatedDeal.aggregate_value)+Number(updatedDeal.cash_assets)-Number(updatedDeal.deal_debt)-Number(updatedDeal.aggregate_debt);
            console.log( "\nNew Deal Equity value is : "+equity_value);
            let newDealEntity = {
                  name: updatedDeal.name,
                  taxid: formDeal.taxid,
                  implied_value: equity_value,
                  ownership_status: oldDealEntity.ownership_status,
                  id: oldDealEntity.id
          }


            console.log( "\nUpodating Deal -- here is NewEntity for deal: "+JSON.stringify(newDealEntity));
            var updateEntityResults = await iraSQL.updateEntity(newDealEntity);
            //req.flash('login', "In deals, added entity #: "+insertEntityResults.insertId);

            let outputLog = await calc.updateValueofInvestorsUpstream (newDealEntity.id);
            //console.log("Output Log on catch side is: "+outputLog.toString()+"\n")
            res.render('show-results', {
                  userObj: userObj,
                  message: "Deal Update Transaction",
                  entity: newDealEntity,
                  logEntries: outputLog
            }); //  render

   } //async function
}); //process add-deal route


// insert the new deal and corresponding entity
app.get('/add-deal', checkAuthentication, (req, res) => {
  //app.get('/add-deal', (req, res) => {
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
        console.log("Process Add Deal problem: "+err);
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






//route for add entity
  app.get('/add-entity', checkAuthentication, (req, res) => {
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


app.get('/updateentity/:id', checkAuthentication, (req, res) => {
    if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
    }
    //call the async function
    pullEntityDetails().catch(err => {
          console.log("Pull Deal Details problem: "+err);
    })

    async function pullEntityDetails() {
          var entity = await iraSQL.getEntityById(req.params.id);
          console.log("have Entity   "+ JSON.stringify(entity));


          res.render('update-entity', {
                userObj: userObj,
                message: "Updating Entity: " + entity.name,
                entity: entity,
                impliedValue: entity.implied_value,
                formattedImpliedValue: calc.formatCurrency(entity.implied_value),
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
              ownership_status: formEntity.ownership_status,
              implied_value: parseFloat(formEntity.impliedValue)*1.0000
              //implied_value: 123.2
            }
            console.log("\nUpdated entity, ready to send to SQL  "+JSON.stringify(updatedEntity));

            let updateEntityResults = await iraSQL.updateEntity(updatedEntity);
            console.log( "Updated entity  no.: "+updatedEntity.id);
            req.flash('login', "Updated Entity: "+updatedEntity.id+"  ");
            res.redirect('/entities');

   } //async function
}); //process add-deal route


//========== AUTH ===================



app.get('/updateuser/', checkAuthentication, (req, res) => {
          if (req.session && req.session.passport) {
             userObj = req.session.passport.user;
           }
          iraLogger.log('info', '/updateuser U:'+userObj.email);
          res.render('update-user', {
                  userObj: userObj,
                  sessionInfo: req.session,
                  updateendpoint: '/process_user_update'
          });
   });  //end UPDATE request

app.post('/process_user_update', urlencodedParser, (req, res) => {

    //call the async function
    updateUserInfo().catch(err => {
          console.log("Problem updating User info: "+err);
    })

    async function updateUserInfo()  {
             const data = req.body
             console.log("Just got form: "+JSON.stringify(data)+"<br>")
             //check if they entered the right old password
             //function authUser (email, password, done) {
             //pModel.authUser (username, password, (err, autheduser) => {

              console.log("Session-Info-passport"+JSON.stringify(req.session.passport,null,4))

             var updatedUser =
             {
               "id":userObj.id,
               "firstname":data.firstname,
               "lastname":data.lastname,
               "email":data.email,
               "photo":data.photo,
               "password": data.newpass
             }

             if (data.newpass === "") {
                 updatedUser.password = userObj.password;
            }

             console.log("\nHere is the New User v5 "+JSON.stringify(updatedUser,null,5))

              let results = await iraSQL.updateUser (updatedUser);
              req.flash('login', "Updated USER "+updatedUser.lastname+".  ")
              console.log("Updated  "+updatedUser.lastname+" with " +JSON.stringify(results));
              res.redirect('/home');



          } //async function
    }); // Route

          //    //hash the NEW password - changing password
          //     bcrypt.genSalt(10, function(err, salt) {
          //            if (err) return err;
          //            bcrypt.hash(data.newpass, salt, function(err, hash) {
          //                   console.log("hashing "+err)
          //                   if (err) return err;
          //                   if (data.newpass === "") {
          //                       updatedUser.password = userObj.password;
          //                   } else {
          //                        updatedUser.password = hash
          //                   }
          //                   console.log("\n\nHere is the New User v5 "+JSON.stringify(updatedUser))
          //                   pModel.updateUser (updatedUser, (err, status) => {
          //                          //err comes back but not results
          //                          if (err) {
          //                            console.log("\n\nModel Update problem "+JSON.stringify(err));
          //                          } else {
          //                          req.flash('login', "Updated USER "+updatedUser.lastname+".  ")
          //                          console.log("Updated  "+updatedUser.lastname+" with " +JSON.stringify(status));
          //                          res.redirect('/home');
          //                          }
          //                  });//updateuser
          //          }); //hash
          //  }); //getSalt






app.get('/login', (req, res, next) => {
        res.render('login', {
                postendpoint: '/checklogin',
                message: req.flash('login')
        });
});



//grab info, call strategy
app.post('/checklogin', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {

    if (err) { return next(err); }

    //if you did not get a user back from Strategy
    if (!user) {
      req.flash('login', 'Credentials could not be verified, please try again.')
      return res.redirect('/login');
    }
    //found user
    req.logIn(user, function(err) {
          if (err) {
            req.flash('login', 'Login problem '+err)
            return next(err);
          }


      console.log('START OF SESSION for user '+user.id+" sending to "+req.session.return_to)
      req.flash('login', 'Login success: '+req.session.passport.user.email); //does not work yet
      //req.session.user = user; //put user object in session - dont need this

      //on first login, use this to redirect
      if (req.session.return_to) {
            return res.redirect(req.session.return_to);  //WORKS?
      } else return res.redirect("/");

      //return res.redirect(url);

    });
  })(req, res, next);
});

app.get('/logout', function(req, res, next){
    req.logout();
    userObj =
    {
      "id":0,
      "firstname":"Log In",
      "lastname":"",
      "email":"",
      "password":"",
      "photo":"https://raw.githubusercontent.com/wilsonvargas/ButtonCirclePlugin/master/images/icon/icon.png",
      "access":0
    }
    res.redirect('/login');
  });




// Passport Strategy
passport.use(new LocalStrategy(
  {
    passReqToCallback: true
  },
  (req, username, password, done) => {
         iraSQL.authUser (username, password, (err, autheduser) => {
                 //err comes back but not results
                 if (err) {
                   console.log("call to model is err "+JSON.stringify(err));
                   //req.flash('login', 'strategy: bad user name or password')
                   return done(null, false);
                 }
                 if (!autheduser) {
                        console.log("strategy: user "+ username +" not found ");
                        iraLogger.log('info', '/login failure U:'+username);
                        return done(null, false);
                 }
                 console.log("OK autheduser is "+autheduser.firstname+"(in Local Strategy)");
                 iraLogger.log('info', '/login success U:'+autheduser.email);
                 return done(null, autheduser);

          }) //loginuser


})) //localstrategy



    passport.serializeUser(function(user, done){
        done(null, user);  //save user or just user.id in session
    });

    passport.deserializeUser(function(user, done){
        //connection.query("select * from tbl_users where id = "+ id, function (err, rows){
            done(null, user);

    });


      // User found - check passwpord
      // bcrypt.compare(checkpass, user.password, (err, isValid) => {
      // }) //bcrypt

//NOT FIRST TIME LOGIN
function checkAuthentication(req,res,next){
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
}
