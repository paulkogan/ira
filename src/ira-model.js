
'use strict';
const extend = require('lodash').assign;
const mysql = require('mysql');
const nconf = require('nconf');
const deployConfig = require('./ira-config');
const passport  = require('passport');
const winston = require('winston')
const iraApp =  require('../ira');
const bcrypt = require('bcrypt');

//CHANGE ENV HERE
const env = 'ebawsira-dev'

let options = {};

// console.log("in ira-model, the endpoint is "+nconf.get('DEV_ENDPOINT'))
// console.log("in ira-model, the dbuser is "+nconf.get('DEV_USER'))
// console.log("in ira-model, the password is "+nconf.get('DEV_PASSWORD'))
// console.log("in ira-model, the DBname is "+nconf.get('DEV_DBNAME'))


if (env === 'ebawsira-dev') {
        options = {
          user: deployConfig.get('DEV_USER'),
          password: deployConfig.get('DEV_PASSWORD'),
          host: deployConfig.get('DEV_ENDPOINT'),
          database: deployConfig.get('DEV_DBNAME'),
          port: 3306,
          multipleStatements: true
        };
}



if (env === 'ebawsira-prod') {
        options = {
          user: deployConfig.get('PROD_USER'),
          password: deployConfig.get('PROD_PASSWORD'),
          host: deployConfig.get('PROD_ENDPOINT'),
          database: deployConfig.get('PROD_DBNAME'),
          port: 3306,
          multipleStatements: true
        };
}


const connection = mysql.createConnection(options);

connection.connect(function(err) {
      if (err) {
            console.error('error connecting to SQL: ' + err.stack);
            return;
      } else {
            console.log('connected as id ' + connection.threadId+"to ");
      }
});


module.exports = {
  searchEntities,
  getAllEntities,
  getAllTransactions,
  getCapitalCallsForEntity,
  getCapitalCallById,
  getOwnershipForEntity,
  getUniqueOwnershipForEntity,
  getOwnershipForEntityUpstreamUpdate,
  getOwnershipForInvestor,
  getOwnershipForInvestorAndEntity,
  getOwnTransByTransID,
  getEntityById,
  getEntityByDealId,
  getEntitiesByTypes,
  getEntitiesByOwnership,
  getTransactionById,
  getTransactionsForInvestorAndEntity,
  getTransactionsByType,
  getTransactionsForInvestment,
  getTransactionsForCapitalCall,
  getDealById,
  getEntityTypes,
  getTransactionTypes,
  insertEntity,
  insertTransaction,
  insertDeal,
  insertOwnership,
  insertOwnTrans,
  insertCapitalCall,
  updateEntity,
  updateEntityImpliedValue,
  updateDeal,
  clearOwnershipForEntity,
  deleteTransaction,
  findUser,
  getUserDetails,
  updateUser,
  authUser
};





//without Bcrypt for now
function authUser (email, password, done) {
  connection.query(
    'SELECT * FROM users WHERE email = ?', email,  (err, results) => {
      if (!err && !results.length) {
              done("Not found "+ email+" got "+err, null);
              return;
      }

      if (err) {
        done("Search error" +err, null);
        return;
      }

     let checkPlainPW = (password === results[0].password)
     console.log("\nPlainCheck is "+checkPlainPW)
     //now try encrypted
     //res is result of comparing encrypted apsswords
     bcrypt.compare(password, results[0].password, function(err, res) {
                   if (err) {
                     console.log("bcrypt - auth error of some kind" +err)
                     done("PW auth error" +err, null);
                     return;
                   }
                   console.log("\nbcrypt res is "+res)

                  if (!(checkPlainPW) && !(res) ) {
                      console.log("\nbad pw "+password+", res is: "+res+"   checkPlainPW is: "+checkPlainPW)
                      done("bad password", null)
                      return
                  }
                console.log(results[0].firstname+" has authed in authuser");
                done(null, results[0]);
    }); //bcrypt

     /*
      if (checkPlainPW) {
        console.log(results[0].firstname+" has authed plain ");
        done(null, results[0]);
      } else {
          console.log("\nbad pw "+password+",  plain checkPlainPW is: "+checkPlainPW)
          //iraApp.logger.log('info', '/login failure U:'+email);
          done("bad password", null)

      } //if plain
    */


  } //cb function
 ) //connection querty
} //authuser










function getEntitiesByTypes(wantedTypes) {
     if (!wantedTypes) wantedTypes = [1,2,3,4]

      let queryString =
      'SELECT e.id as id, types.name as entity_type, e.name as name, e.taxid as taxid, e.ownership_status as own_status FROM entities as e'
        + ' JOIN entity_types as types ON types.type_num = e.type'
        + ' WHERE e.type IN ('+wantedTypes.join()+')';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function



function getTransactionsForCapitalCall (cc_id, transTypes) {

  if (!transTypes) transTypes = [8]

  //console.log("\nIn Model, TransTypes are: "+JSON.stringify(transTypes)+"\n\n")

  let queryString = 'SELECT t.id as id,  t.investor_entity_id as investor_entity_id,  t.investment_entity_id as investment_entity_id, t.passthru_entity_id as passthru_entity_id,'
  + ' investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' t.trans_type as tt_id, trans_types.name as tt_name, t.capital_call_id as cc_id,'
  + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wired_date, t.amount as t_amount, t.own_adj as t_own_adj, t.notes as t_notes'
  + ' FROM transactions as t'
  + ' JOIN entities as investment ON investment.id = t.investment_entity_id'
  + ' JOIN entities as investor ON investor.id = t.investor_entity_id'
  + ' JOIN transaction_types as trans_types ON t.trans_type = trans_types.type_num'
  + ' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id'
  + ' WHERE t.capital_call_id ='+cc_id
  //+ ' AND t.trans_type = 1'
  + ' AND t.trans_type IN ('+transTypes.join()+')'
  + ' ORDER BY t.id DESC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Cant find transcations "+err)
                            fail(err)
                      } else {
                            console.log ("In Model: for CC "+cc_id+" found "+results.length+" transactions \n")
                            //console.log ("The results are:"+JSON.stringify(results))
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function




//owneship: parent_entity_id, child_entity_id, capital_pct
function getCapitalCallsForEntity(dealEntityID) {
    let queryString = ""
    if(dealEntityID) {
          queryString = 'SELECT * from capital_calls WHERE deal_entity_id='+dealEntityID;
      //console.log ("in getOwnTransByTransID, the query string is "+queryString+"\n\n")
    } else {
          queryString = 'SELECT * from capital_calls'

    }

    return new Promise(   function(succeed, fail) {
          connection.query(queryString,
            function(err, results) {
                    if (err) {
                          fail(err)
                    } else {
                        //console.log ("in Moooodel, got records "+JSON.stringify(results)+"")
                        succeed(results)
                    }
            }); //connection
        }); //promise


} // function


//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnTransByTransID (transaction_id) {
  let queryString = 'SELECT * from own_trans_lookup WHERE trans_id='+transaction_id;
  //console.log ("in getOwnTransByTransID, the query string is "+queryString+"\n\n")

      return new Promise(   function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                          //console.log ("in Moooodel, got own-trans records "+JSON.stringify(results)+"")
                          succeed(results[0])
                      }
              }); //connection
          }); //promise


} // function






function updateUser (updateuser) {
    console.log("\n\nHere at update: email:"+ updateuser.email +" PW:"+updateuser.password+" ID:"+updateuser.id)


    return new Promise(   function(succeed, fail) {
          connection.query(
          'UPDATE users SET email = ?, photo =?, password=? WHERE id=?',
          [updateuser.email, updateuser.photo, updateuser.password, updateuser.id],
          function(err, results) {
                  if (err) {
                        fail(err)
                  } else {
                      //console.log ("in Moooodel, got uodated user "+JSON.stringify(results)+"")
                      succeed(results)
                  }
          }); //connection
      }); //promise
  } //updateuser


function getUserDetails (id) {

    //let queryString = 'SELECT id, firstname, lastname, photo from users WHERE email='+targetemail;
    let queryString = 'SELECT id, email, firstname, lastname, photo from users WHERE id='+id;
   //let queryString = 'SELECT id, firstname, lastname, photo from users WHERE email = ?', targetemail;
    return new Promise(   function(succeed, fail) {
          connection.query(queryString,
            function(err, results) {
                    if (err) {
                          fail(err)
                    } else {
                        console.log ("in Moooodel, got user info "+JSON.stringify(results)+"")
                        succeed(results[0])
                    }
            }); //connection
        }); //promise
} //findUser




function findUser (email, cb) {
  connection.query(
    'SELECT * FROM users WHERE email = ?', email,  (err, results) => {
      if (!err && !results.length) {
              cb("Not found "+ email+" got "+err);
              return;
      }

      if (err) {
        cb("Search error" +err);
        return;
      }
      cb(null, results[0]);
    });
}





//========================= Auth =====================






//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnTransByTransID (transaction_id) {
  let queryString = 'SELECT * from own_trans_lookup WHERE trans_id='+transaction_id;
  //console.log ("in getOwnTransByTransID, the query string is "+queryString+"\n\n")

      return new Promise(   function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                          //console.log ("in Moooodel, got own-trans records "+JSON.stringify(results)+"")
                          succeed(results[0])
                      }
              }); //connection
          }); //promise


} // function




function searchEntities (searchTerm) {
    let queryString = "SELECT name, id FROM entities WHERE name LIKE '%"+searchTerm+"%'";
    if (!searchTerm) {
      queryString = "SELECT name, id FROM entities";
    }
    //SELECT * FROM `my_table` WHERE CONTAINS(name, 'search')
    //'SELECT * from transactions WHERE id = ?', trans_id,

    console.log ("in searchEntities, the query string is "+queryString+"\n\n")

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            console.log ("In Model search - results are "+JSON.stringify(results)+"\n")
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function




function getTransactionsForInvestorAndEntity (investorId, dealEntityId, transTypes) {
  let queryString = 'SELECT t.id, t.investor_entity_id as investor_entity_id,  t.investment_entity_id as investment_entity_id, t.passthru_entity_id as passthru_entity_id,'
  + ' investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' trans_types.name as tt_name, t.trans_type as tt_id, t.notes as t_notes,'
  + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wired_date, t.amount as t_amount, t.own_adj as t_own_adj'
  + ' FROM transactions as t'
  + ' JOIN transaction_types as trans_types ON t.trans_type = trans_types.type_num'
  + ' JOIN entities as investment ON investment.id = t.investment_entity_id'
  + ' JOIN entities as investor ON investor.id = t.investor_entity_id'
  + ' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id'
  + ' WHERE t.investor_entity_id ='+investorId
  + ' AND t.investment_entity_id ='+dealEntityId
  //+ ' AND t.trans_type =1'
  + ' AND t.trans_type IN ('+transTypes.join()+')'
  +' ORDER BY wired_date ASC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Cant find transcations "+err)
                            fail(err)
                      } else {
                            //console.log ("In Model transactionsForInvestor found "+results.length+" transactions for "+results[0].investment_entity_id+"  "+results[0].investment_name+"\n")
                            //console.log ("The results are:"+JSON.stringify(results))
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function




function getTransactionsForInvestment (invest_entityId, transTypes) {

  if (!transTypes) transTypes = [1,2,3,4,5,6,7,8]

  //console.log("\nIn Model, TransTypes are: "+JSON.stringify(transTypes)+"\n\n")

  let queryString = 'SELECT t.id as id,  t.investor_entity_id as investor_entity_id,  t.investment_entity_id as investment_entity_id, t.passthru_entity_id as passthru_entity_id,'
  + ' investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' t.trans_type as tt_id, trans_types.name as tt_name,'
  + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wired_date, t.amount as t_amount, t.own_adj as t_own_adj, t.notes as t_notes'
  + ' FROM transactions as t'
  + ' JOIN entities as investment ON investment.id = t.investment_entity_id'
  + ' JOIN entities as investor ON investor.id = t.investor_entity_id'
  + ' JOIN transaction_types as trans_types ON t.trans_type = trans_types.type_num'
  + ' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id'
  + ' WHERE t.investment_entity_id ='+invest_entityId
  //+ ' AND t.trans_type = 1'
  + ' AND t.trans_type IN ('+transTypes.join()+')'
  + ' ORDER BY t.id DESC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Cant find transcations "+err)
                            fail(err)
                      } else {
                            console.log ("In Model: for Ownership found "+results.length+" transactions \n")
                            //console.log ("The results are:"+JSON.stringify(results))
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function



function getAllTransactions () {

            //  'SELECT * from transactions',
            let queryString = 'SELECT t.id as id,  t.investor_entity_id as investor_entity_id,  t.investment_entity_id as investment_entity_id, t.passthru_entity_id as passthru_entity_id,'
            + ' investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
            + ' t.trans_type as tt_id, trans_types.name as tt_name,'
            + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wired_date, t.amount as t_amount, t.own_adj as t_own_adj, t.notes as t_notes'
            + ' FROM transactions as t'
            + ' JOIN entities as investment ON investment.id = t.investment_entity_id'
            + ' JOIN entities as investor ON investor.id = t.investor_entity_id'
            + ' JOIN transaction_types as trans_types ON t.trans_type = trans_types.type_num'
            + ' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id'
            + ' ORDER BY t.id DESC';



          return new Promise(function(succeed, fail) {
                          connection.query(queryString,
                            function(err, results) {
                                if (err) {
                                    fail(err)
                               } else {
                                    succeed(results)
                            }
                          }); //connection
          }); //promise
} // function





function getTransactionTypes() {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT * from transaction_types',
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function

function getEntityTypes () {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT * from entity_types',
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function

function getEntityByDealId (deal_id) {
  let queryString = 'SELECT * from entities WHERE deal_id ='+deal_id;
      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            if (!results[0]) {
                                    fail("No such entity, sorry")
                            }

                            //console.log ("Success found by Id entity "+results[0].name +"\n")
                            succeed(results[0])
                      }
              }); //connection
      }); //promise
} // function



//owneship: parent_entity_id, child_entity_id, capital_pct
function getEntityById (entity_id) {
  let queryString = 'SELECT * from entities WHERE id ='+entity_id;
  //console.log ("in getEntiyById, the query string is "+queryString+"\n\n")
      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                //console.log ("Searching Entity the resukts are "+results +"\n")
                    if (!results || results === undefined || results.length < 1) {
                         fail("No such entity, sorry")
                         return
                    }
                    if (err) {
                            fail(err)
                      } else {

                            //console.log ("Success found by Id entity "+results[0].name +"\n")
                            succeed(results[0])
                      }
              }); //connection
      }); //promise
} // function



//owneship: parent_entity_id, child_entity_id, capital_pct
function getDealById (deal_id) {
  let queryString = 'SELECT * from deals WHERE id ='+deal_id+' ORDER BY id';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results[0])
                      }
              }); //connection
      }); //promise
} // function


  //owneship: parent_entity_id, child_entity_id, capital_pct
  function getOwnershipForInvestorAndEntity (child_id, investor_id) {
    let queryString = 'SELECT o.id, investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
    + ' investment.id as investment_id, investor.id as investor_id,'
    //' DATE_FORMAT(t.wired_date, "%b %d %Y") as wired_date, t.trans_type as tt_id,'
    + ' o.amount as amount, ROUND(o.capital_pct,4) as capital_pct FROM ownership as o'
    + ' JOIN entities as investment ON investment.id = o.child_entity_id'
    + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
    + ' LEFT JOIN entities as passthru ON passthru.id = o.passthru_entity_id'
    // ' LEFT JOIN own_trans_lookup as own_trans on own_trans.own_id = o.id'
    //' JOIN transactions as t on t.id = own_trans.trans_id'
    + ' WHERE o.child_entity_id ='+child_id
    + ' AND o.parent_entity_id ='+investor_id+' ORDER BY investment_id ASC';


        return new Promise(function(succeed, fail) {
              connection.query(queryString,
                function(err, results) {
                        if (err) {
                              console.log ("Problem in getOwnershipForInvestorAndEntity "+err)
                              fail(err)
                        } else {
                              // if (results.length<1) {
                              //           fail("no ownership data")
                              // }

                              console.log ("Ownership query OK got "+results.length)
                              //console.log ("The results are:"+JSON.stringify(results, null,4))
                              succeed(results)
                        }
                }); //connection
        }); //promise
  } // function






//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnershipForInvestor (investor_id) {
  let queryString = 'SELECT o.id, investment.deal_id as deal_id, investor.name as investor_name,'
  + ' investment.name as investment_name, investment.id as investment_id, investor.id as investor_id, passthru.name as passthru_name,'
  //+ ' DATE_FORMAT(t.wired_date, "%b %d %Y") as wired_date, t.amount as amount, t.id as t_id,'
  + ' ROUND(o.capital_pct,4) as capital_pct, o.amount as amount FROM ownership as o'
  + ' JOIN entities as investment ON investment.id = o.child_entity_id'
  + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
  + ' LEFT JOIN entities as passthru ON passthru.id = o.passthru_entity_id'
  + ' WHERE o.parent_entity_id ='+investor_id+' ORDER BY investment_id ASC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Problem in getOwnershipForInvestor "+err)
                            fail(err)
                      } else {
                            if (results.length<1) {
                                      fail("no ownership data")
                            } else {

                              //console.log ("\n\nIn model: getOwnershipForInvestor, got "+results.length+" investments for "+results[0].investor_name)
                              //console.log (JSON.stringify(results)+"\n\n")
                              succeed(results)

                            }


                      }
              }); //connection
      }); //promise
} // function

//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnershipForEntityUpstreamUpdate (child_id) {
  let queryString = 'SELECT o.id, investor.name as investor_name, investment.name as investment_name,'
  + ' investment.id as investment_id, investor.id as investor_id,'
  + ' investor.type as investor_type_num, etypes.name as investor_type_name,'
  + ' o.amount as amount, ROUND(o.capital_pct,4) as capital_pct FROM ownership as o'
  + ' JOIN entities as investment ON investment.id = o.child_entity_id'
  + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
  + ' JOIN entity_types as etypes ON etypes.type_num = investor.type'
  + ' WHERE o.child_entity_id ='+child_id+' ORDER BY amount ASC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("problem in  getOwnershipForEntityUpstreamUpdate "+err)
                            fail(err)
                      } else {
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }

                            console.log ("Ownership query OK got "+results.length)
                            //console.log ("The results are:"+JSON.stringify(results, null,4))
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function

//owneship: parent_entity_id, child_entity_id, capital_pct
function getUniqueOwnershipForEntity (child_id) {
  let queryString = 'SELECT o.id, investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' investment.id as investment_id, investor.id as investor_id,'
  + ' o.amount as amount, ROUND(o.capital_pct,4) as capital_pct FROM ownership as o'
  + ' JOIN entities as investment ON investment.id = o.child_entity_id'
  + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
  + ' LEFT JOIN entities as passthru ON passthru.id = o.passthru_entity_id'
  + ' WHERE o.child_entity_id ='+child_id+' ORDER BY amount DESC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Problem in getOwnershipForEntity "+err)
                            fail(err)
                      } else {
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }

                            console.log ("Ownership query OK got "+results.length)
                            //console.log ("The results are:"+JSON.stringify(results, null,4))
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function

//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnershipForEntity (child_id) {
  let queryString = 'SELECT o.id, investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' investment.id as investment_id, investor.id as investor_id,'
  + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as wired_date, t.trans_type as tt_id,'
  + ' o.amount as amount, ROUND(o.capital_pct,4) as capital_pct FROM ownership as o'
  + ' JOIN entities as investment ON investment.id = o.child_entity_id'
  + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
  + ' LEFT JOIN entities as passthru ON passthru.id = o.passthru_entity_id'
  + ' LEFT JOIN own_trans_lookup as own_trans on own_trans.own_id = o.id'
  + ' JOIN transactions as t on t.id = own_trans.trans_id'
  + ' WHERE o.child_entity_id ='+child_id+' ORDER BY amount DESC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Problem in getOwnershipForEntity "+err)
                            fail(err)
                      } else {
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }

                            console.log ("Ownership query OK got "+results.length)
                            //console.log ("The results are:"+JSON.stringify(results, null,4))
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function





function getEntitiesByOwnership(ownStatus) {
      let queryString =
      'SELECT e.id as id, t.name as entity_type, e.name as name, e.taxid as taxid, e.ownership_status as own_status FROM entities as e'
        + ' JOIN entity_types as t ON t.type_num = e.type'
        + ' WHERE e.ownership_status='+ownStatus+' ORDER BY entity_type ASC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function


function getAllEntities() {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT e.id as id, t.name as entity_type, e.type as e_type_num, e.name as name,'
              + ' e.taxid as taxid, e.ownership_status as own_status, e.implied_value as implied_value'
            + ' FROM entities as e'
            +' JOIN entity_types as t ON t.type_num = e.type ORDER BY entity_type ASC',
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function



function getTransactionsByType (transType) {
  let queryString =
  'SELECT t.id as id, investment.name as investment_name, investor.name as investor_name, passthru.name as passthru_name,'
  +' trans_types.name as tt_name,'
  +' DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wireddate,'
  +' TRUNCATE(t.amount,2) as t_amount, t.notes as t_notes FROM transactions as t'
  +' JOIN entities as investment ON investment.id = t.investment_entity_id'
  +' JOIN entities as investor ON investor.id = t.investor_entity_id'
  +' JOIN transaction_types as trans_types ON t.trans_type = trans_types.type_num'
  +' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id '
  +' WHERE t.trans_type='+transType+' ORDER BY id DESC';


  return new Promise(function(succeed, fail) {
        connection.query(queryString,
          function(err, results) {
                  if (err) {
                        fail(err)
                  } else {
                        succeed(results)
                  }
          }); //connection
  }); //promise
} // function










function getTransactionById (trans_id) {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT * from transactions WHERE id = ?', trans_id,
              function(err, results) {
                      if (err) {
                          console.log ("in Model: TransByID problem "+err)
                            fail(err)
                      } else {
                            //console.log ("in Model: TransByID "+JSON.stringify(results))
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function


function getCapitalCallById (cc_id) {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT * from capital_calls WHERE id = ?', cc_id,
              function(err, results) {
                      if (err) {
                          console.log ("in Model: CCByID problem "+err)
                            fail(err)
                      } else {
                            //console.log ("in Model: CapCallbyId "+JSON.stringify(results))
                            succeed(results[0])
                      }
              }); //connection
      }); //promise
} // function





function insertOwnTrans(own_id, trans_id) {
      let queryString = "INSERT INTO own_trans_lookup (own_id, trans_id) VALUES"
      + " ("+own_id+", "+trans_id+")"

      //console.log ("in insert own_trans, the query string is "+queryString+"\n\n")
         return new Promise(function(succeed, fail) {
               connection.query(queryString,
                 function(err, results) {
                         if (err) {
                               fail(err)
                         } else {
                                succeed(results.affectedRows)
                         }
                 }); //connection
         }); //promise
} // function





function insertCapitalCall (capitalCall) {
      console.log("In Model, adding new Capital Call: "+JSON.stringify(capitalCall))
      return new Promise(function(succeed, fail) {
            connection.query(
            'INSERT INTO capital_calls SET ?', capitalCall,
                function(err, results) {
                          if (err) {
                                console.log("Problem inserting capital_calls SQL"+err)
                                fail(err)
                          } else {
                                //console.log("In model, results: "+JSON.stringify(results));
                                succeed(results)
                          }
              }); //connection
      }); //promise
} // function





function insertEntity (entity) {
      console.log("In Model, adding new entity: "+JSON.stringify(entity))
      return new Promise(function(succeed, fail) {
            connection.query(
            'INSERT INTO entities SET ?', entity,
                function(err, results) {
                          if (err) {
                                console.log("Problem inserting Entity SQL"+err)
                                fail(err)
                          } else {
                                //console.log("In model, results: "+JSON.stringify(results));
                                succeed(results)
                          }
              }); //connection
      }); //promise
} // function



function insertDeal(deal) {
    console.log("In Model, adding new deal: "+JSON.stringify(deal))
    return new Promise(function(succeed, fail) {
          connection.query(
          'INSERT INTO deals SET ?', deal,
            function(err, results) {
                    if (err) {
                          console.log("Problem inserting Deal SQL"+err)
                          fail(err)
                    } else {
                          //console.log("In model, results: "+JSON.stringify(results));
                          succeed(results)
                    }
            }); //connection
    }); //promise
} // function


function insertTransaction (transaction) {
    console.log("In Model, adding new transaction: "+JSON.stringify(transaction))
    return new Promise(function(succeed, fail) {
          connection.query(
          'INSERT INTO transactions SET ?', transaction,
            function(err, results) {
                    if (err) {
                          console.log("Problem inserting transcation SQL"+err)
                          fail(err)
                    } else {
                          //console.log("In model, results: "+JSON.stringify(results));
                          succeed(results)
                    }
            }); //connection
    }); //promise
} // function


function insertOwnership (ownershipRow) {
    //console.log("In Model, adding new ownership row: "+JSON.stringify(ownershipRow))
    return new Promise(function(succeed, fail) {
          connection.query(
          'INSERT INTO ownership SET ?', ownershipRow,
            function(err, results) {
                    if (err) {
                          console.log("Problem inserting owmership SQL"+err)
                          fail(err)
                    } else {
                          //console.log("In model, results: "+JSON.stringify(results));
                          succeed(results)
                    }
            }); //connection
    }); //promise
} // function



function updateDeal (updatedDeal) {
    let queryString = 'UPDATE deals SET'
    +' name = \''+updatedDeal.name+'\','
    +' aggregate_value = \''+updatedDeal.aggregate_value+'\','
    +' aggregate_debt = \''+updatedDeal.aggregate_debt+'\','
    +' cash_assets = \''+updatedDeal.cash_assets+'\','
    +' deal_debt = \''+updatedDeal.deal_debt+'\','
    +' notes=\''+updatedDeal.notes+'\''
    +' WHERE id ='+updatedDeal.id+'';

   //console.log ("in update deal, the query string is "+queryString+"\n\n")

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            //console.log ("In Model, Success - Updated entity with "+JSON.stringify(results)+"\n")
                            succeed(results.affectedRows)
                      }
              }); //connection
      }); //promise
} // function


function updateEntityImpliedValue (updatedEntity) {

  let queryString = 'UPDATE entities SET'
  +' implied_value=\''+updatedEntity.implied_value+'\''
  +' WHERE id ='+updatedEntity.id+'';
 //console.log ("\n\nIn model, updateEntity, here is the query"+queryString+"\n")

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            //console.log ("Model Success - Updated entity"+updatedEntity.name+"\n")
                            succeed(results.affectedRows)
                      }
              }); //connection
      }); //promise
} // function


function updateEntity (updatedEntity) {

  let queryString = 'UPDATE entities SET'
  +' ownership_status = \''+updatedEntity.ownership_status+'\','
  +' name=\''+updatedEntity.name+'\','
  +' taxid=\''+updatedEntity.taxid+'\','
  +' implied_value=\''+updatedEntity.implied_value+'\''
  +' WHERE id ='+updatedEntity.id+'';
 console.log ("\n\nIn model, updateEntity, here is the query"+queryString+"\n")

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            console.log ("Model Success - Updated entity"+updatedEntity.name+"\n")
                            succeed(results.affectedRows)
                      }
              }); //connection
      }); //promise
} // function

function deleteTransaction(transaction_id) {

  let queryString = 'DELETE FROM transactions where id='+transaction_id+";"

  console.log("In Model, deletng transaction, the query string is "+queryString)
  return new Promise(function(succeed, fail) {
        connection.query(queryString,
          function(err, results) {
                  if (err) {
                        fail(err)
                  } else {
                        succeed(results)
                  }
          }); //connection
  }); //promise
} // function




function clearOwnershipForEntity (entity_id, own_trans_array) {
console.log("In Model, clearing Ownership: "+own_trans_array.toString())

  let queryString =
  'UPDATE entities SET ownership_status=0 where id ='+entity_id+";"
  + ' DELETE FROM own_trans_lookup where own_id IN ('+own_trans_array.join()+');'
  + ' DELETE FROM ownership where id IN ('+own_trans_array.join()+');';

 //console.log("In Model, clearing Ownership, the query string is "+queryString)

  return new Promise(function(succeed, fail) {
        connection.query(queryString,
          function(err, results) {
                  if (err) {
                        fail(err)
                  } else {
                        succeed(results)
                  }
          }); //connection
  }); //promise
} // function
