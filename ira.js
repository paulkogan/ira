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
const iraVersion = "0.6 +Add Deal"
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
     return "$"+amount.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
}


function validateOwnership (investors) {
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
          console.log("have Entity   "+ entity.name);
          var deals = await iraSQL.getDealDetails(entity.deal_id);
          console.log("Before Ownership, have Entity   "+ entity.name+"   and Deal is  "+JSON.stringify(deals));
          var investors = await iraSQL.getOwnershipForEntity(entity.id)
          if (investors.length>0) {
                                let results = validateOwnership(investors)
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









app.get('/ownership/:id', (req, res) => {
              if (req.session && req.session.passport) {
                 userObj = req.session.passport.user;
               }


  iraSQL.getEntityDetails(req.params.id).then(
    function(result) { //got a good entity
      //console.log("what I got: "+JSON.stringify(result));
      console.log("in get Ownership, have Entity   "+ result.name+"   getting Owners for "+result.id);
      iraSQL.getOwnershipForEntity(result.id).then(
              function(investors) {
                          if (investors.length>0) {
                          let results = validateOwnership(investors)
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
                                        res.render('deal-ownership', {
                                              userObj: userObj,
                                              message:  "No Ownership information found ",
                                              dealName: foundEntity.name
                                        }); //  render

                  }  //if-else  - no ownership get name of entity

          }).catch(error => {
                          console.log("getOwnershipForEntity problem: "+error);
                          return;
          }); //then ownership promise



      }, function(error) {   //not getting entity
                console.log("No entity found" + req.params.id)
                req.flash('login', "No entity "+req.params.id+".  ")
                res.redirect('/home')


  }); //then enity promise then
}); //route - ownership








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
                async function(transactions) {
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




app.get('/entities', (req, res) => {
  if (req.session && req.session.passport) {
     userObj = req.session.passport.user;

   }

          iraSQL.getAllEntities().then(
                async function(entities) {
                          //let expandInvestors = await addPortfolioToInvestors(investors)
                          //let msg = await addPortfolioToInvestors(investors)[1]
                          res.render('list-entities', {
                                  userObj: userObj,
                                  sessioninfo: JSON.stringify(req.session),
                                  message: req.flash('login') + "Showing "+entities.length+" entities.",
                                  entities: entities
                          });//render


                }, function(err) {   //failed
                               console.log("List entitiesproblem: "+err);
                               return;
                } //  success function
          ); //getAll Entities then
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


// props.get('/viewprop/:id', checkAuthentication, (req, res) => {
//
//      if (req.session && req.session.passport) {
//           userObj = req.session.passport.user;
//       }
//
//      sessioninfo = JSON.stringify(req.session);
//
//
//      pModel.read (req.params.id, (err, entity) => {
//            //err comes back but not results
//            if (err) {
//              console.log("Viewprop problem "+JSON.stringify(err));
//            }
//
//            let expandProperty = entity
//            expandProperty.propValue = parseFloat(expandProperty.units*unitValue);
//
//            pModel.getInvestorList(entity.id, function(err, investors){
//                    if (err) {
//                          //next(err);
//                          console.log("Investor problems "+err);
//                          return;
//                    }
//                    let expandPropInvestors = investors
//                    let totalInvestorsOwnership = 0.00
//                    let totalInvestorsValue = 0.00
//                    investors.forEach(function(item, key) {
//                          expandPropInvestors[key].percent = parseFloat(investors[key].ownership)/10;
//                          totalInvestorsOwnership += expandPropInvestors[key].percent
//                          expandPropInvestors[key].investmentValue = expandProperty.propValue * (expandPropInvestors[key].percent/100)
//                          totalInvestorsValue += expandPropInvestors[key].investmentValue
//                          //make them 2 digit strings
//                          expandPropInvestors[key].investmentValue = expandPropInvestors[key].investmentValue.toFixed(2)
//                          expandPropInvestors[key].percent  = expandPropInvestors[key].percent.toFixed(2)
//
//                   }) //foreach
//                   expandProperty.propValue = expandProperty.propValue.toFixed(2)
//
//
//                  res.render('viewprop', {
//                          property: expandProperty,
//                          investors: expandPropInvestors,
//                          totalinvestorsvalue: totalInvestorsValue.toFixed(2),
//                          totalinvestorsownership: totalInvestorsOwnership.toFixed(2),
//                          userObj: userObj,
//                          sessioninfo: JSON.stringify(req.session),
//                          message: req.flash('login'),
//
//                  });
//
//           }); //get investor list
//     }); //read
// });   // END VIEWPROP =========
//
//
//
// //FUNCTION - non recusrive promise method
// function addPortfolioToInvestors (investors) {
//       let expandInvestors = investors
//       return new Promise( function(succeed, fail) {
//                 for (let index = 0; index < investors.length; index++) {
//                       pModel.getPortfolioList(investors[index].id, async function(err, investments){
//                               if (err) {
//                                     console.log("Boom! "+err);
//                                     return fail(err);
//                               }
//                                expandInvestors[index].numOfDeals = investments.length;
//                                expandInvestors[index].totalPortfolioValue = calculatePortfolioValue(investments)[1]
//                                console.log("IN getPortfolio: "+ expandInvestors[index].id +" lastname: "+expandInvestors[index].lastname+"   tPV: "+ expandInvestors[index].totalPortfolioValue+"   numOfDeals: "+expandInvestors[index].numOfDeals )
//                                if (index === investors.length-1) {
//                                       console.log("done in loop")
//                                       succeed(expandInvestors)  //give back when array is done
//                               }
//                       }) //get portfolioList
//
//                 } //for
//                 //succeed(expandInvestors)
//         }); //promise
//   } //addPortfolio function
//
//
//
//
//
// props.get('/investors', (req, res) => {
//         if (req.session && req.session.passport) {
//            userObj = req.session.passport.user;
//          }
//
//         //get a list of all investors
//         pModel.getAllInvestorsPromise().then(
//             async function(investors) {
//                       let expandInvestors = await addPortfolioToInvestors(investors)
//                       //let msg = await addPortfolioToInvestors(investors)[1]
//                       console.log ("portfolio success with ")  // succeed
//                       res.render('investors', {
//                               userObj: userObj,
//                               sessioninfo: JSON.stringify(req.session),
//                               message: req.flash('login') + "Showing "+investors.length+" investors.",
//                               investors: expandInvestors
//                       });//render
//
//
//             }, function(err) {   //failed
//                            console.log("Promise add portfolio problem: "+err);
//                            return;
//             } //  success function
//     ); //getAllinvestors then
// }); //  /inevestors route
//
//
//
//
//   props.get('/portfolio/:id', checkAuthentication, (req, res) => {
//
//                      if (req.session && req.session.passport) {
//                         userObj = req.session.passport.user;
//                         console.log ("UserOBJ from Session "+JSON.stringify(userObj))
//                       } else {
//                            res.redirect('/login')
//                            return
//                       }
//
//
//                       pModel.getPortfolioPromise(req.params.id).then(
//                           function(investments) {
//
//                               let expandInvest = calculatePortfolioValue(investments)[0]
//                               let totalPortfolioValue = calculatePortfolioValue(investments)[1]
//
//                               res.render('portfolio', {
//                                       userObj: userObj,
//                                       message:  "Showing "+investments.length+" investments. (Promise)" +req.flash('login'),
//                                       portfolioOwner: investments[0].firstname + " "+investments[0].lastname,
//                                       //portfolioOwner: "Jack",
//                                       investments: expandInvest,
//                                       totalPortfolioValue: totalPortfolioValue,
//                                       xInv: JSON.stringify(expandInvest)
//                               });
//
//                           }, function(err) {
//
//                                       console.log("Promise problem: "+err);
//                                       return;
//
//                           } //function
//                     ); //end then
//
//     }); //portfolio
//
//
//
//   props.get('/properties', (req, res) => {
//
//     if (req.session && req.session.passport) {
//        userObj = req.session.passport.user;
//
//      }
//
//
//             pModel.getAllProps( function(err, properties, cursor){
//                   if (err) {
//                         //next(err);
//                         console.log("Boom! "+err);
//                         return;
//                   }
//
//           let expandProperties = []
//           properties.forEach(function(item, key) {
//           //Object.keys(properties).forEach(function(key) {
//                expandProperties[key]= properties[key];
//                expandProperties[key].propValue = (expandProperties[key].units*unitValue).toFixed(2);;
//                console.log(expandProperties[key].id, expandProperties[key].address)
//              });
//
//
//
//                   res.render('list', {
//                           userObj: userObj,
//                           sessioninfo:  JSON.stringify(req.session),
//                           message: req.flash('login') + "Showing "+properties.length+" properties.",
//                           properties: expandProperties
//                   });
//
//             });
//     }); //proprties
//
//
//
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
//
//
// // ========== HOME & AUTH ========================
//
//
//
//   props.get('/home', (req, res) => {
//
//     if (req.session && req.session.passport) {
//        userObj = req.session.passport.user;
//      }
//
//
//       let menuOptions = []
//       menuOptions[0] = {name:"Properties", link:"/properties"}
//       menuOptions[1] = {name:"Investors", link:"/investors"}
//       menuOptions[2] = {name:"Add Property", link:"/addprop"}
//       menuOptions[3] = {name:"Add Investor", link:"/home"}
//
//       res.render('home', {
//               userObj: userObj,
//               message: req.flash('login'),
//               menuoptions: menuOptions,
//               propsVersion: propsVersion
//       });
//
//   });
//
//
// props.get('/logout', function(req, res){
//     req.logout();
//     userObj =
//     {
//       "id":0,
//       "firstname":"Log In",
//       "lastname":"",
//       "email":"",
//       "password":"",
//       "photo":"https://raw.githubusercontent.com/wilsonvargas/ButtonCirclePlugin/master/images/icon/icon.png",
//       "access":0
//     }
//     res.redirect('/login');
//   });
//
//
// props.get('/login', (req, res) => {
//         res.render('login', {
//                 postendpoint: '/checklogin',
//                 message: req.flash('login')
//         });
// });
//
//
//
// //grab info, call strategy
// props.post('/checklogin', function(req, res, next) {
//   passport.authenticate('local', function(err, user, info) {
//
//     if (err) { return next(err); }
//
//     //if you did not get a user back from Strategy
//     if (!user) {
//       req.flash('login', 'Credentials could not be verified, please try again.')
//       return res.redirect('/login');
//     }
//     //found user
//     req.logIn(user, function(err) {
//           if (err) {
//             req.flash('login', 'Login problem '+err)
//             return next(err);
//           }
//
//
//       console.log('START OF SESSION for user '+user.id+" sending to "+req.session.return_to)
//       req.flash('login', 'Login success: '+req.session.passport.user.email); //does not work yet
//       //req.session.user = user; //put user object in session - dont need this
//
//       //on first login, use this to redirect
//       if (req.session.return_to) {
//             return res.redirect(req.session.return_to);  //WORKS?
//       } else return res.redirect("/");
//
//       //return res.redirect(url);
//
//     });
//   })(req, res, next);
// });
//
//
//

// }); // END LIST =============
//
//
//
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
//
//
//
//
// props.get('/addprop', checkAuthentication, (req, res) => {
//   if (req.session && req.session.passport) {
//      userObj = req.session.passport.user;
//    }
//
//
//         res.render('addprop', {
//                 userObj: userObj,
//                 postendpoint: '/process_add'
//         });
// });
//
//
//
//   // insert the new property
// props.post('/process_add', urlencodedParser, (req, res) => {
//     const data = req.body
//     pModel.create(data, (err, savedData) => {
//       if (err) {
//         //next(err);
//         console.log("Boom! "+err);
//       }
//
//       req.flash('login', "Added property: "+savedData.address)
//       res.redirect('/properties');
//     });
//   });
//
//
// // Basic 404 handler
// props.use((req, res) => {
//   res.status(404).send('404 Props Not Found at '+req.url);
// });
//
//

//
// module.exports = props;
//
//
// //========== passport STRATEGY =========
// passport.use(new LocalStrategy(
//   {
//     passReqToCallback: true
//   },
//   (req, username, password, done) => {
//          pModel.authUser (username, password, (err, autheduser) => {
//                  //err comes back but not results
//                  if (err) {
//                    console.log("call to model is err "+JSON.stringify(err));
//                    //req.flash('login', 'strategy: bad user name or password')
//                    return done(null, false);
//                  }
//                  if (!autheduser) {
//                         console.log("strategy: user "+ username +" not found ");
//                         return done(null, false);
//                  }
//                  console.log("OK autheduser is "+autheduser.firstname);
//                  return done(null, autheduser);
//
//           }) //loginuser
//
//
// })) //localstrategy
//
//
//
//     passport.serializeUser(function(user, done){
//         done(null, user);  //save user or just user.id in session
//     });
//
//     passport.deserializeUser(function(user, done){
//         //connection.query("select * from tbl_users where id = "+ id, function (err, rows){
//             done(null, user);
//
//     });
//
//
//       // User found - check passwpord
//       // bcrypt.compare(checkpass, user.password, (err, isValid) => {
//       // }) //bcrypt
//
// //NOT FIRST TIME LOGIN
// function checkAuthentication(req,res,next){
//           if (userObj.id == 0) {
//                req.session.return_to = "/";
//           } else {
//                req.session.return_to = req.url;
//           }
//
//           if(req.isAuthenticated()){
//                  console.log("YES, authenticated"+req.url)
//                  //req.flash('login', 'checkAuth success')
//                  return next();
//                  //res.redirect(req.url);
//
//           } else {
//               console.log("NO, not authenticated"+req.url)
//               //req.flash('login', 'checkAuth failed, need to login')
//               res.redirect("/login");
//           }
// }
