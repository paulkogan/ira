
'use strict';

const extend = require('lodash').assign;
const mysql = require('mysql');
//const bcrypt = require('bcrypt');
const env = 'ebawsira'

let options = {};

if (env === 'ebawsira') {
        options = {
          user: 'iraadmin',
          password: '',
          host: 'iradb.cdlgrjtshtb6.us-east-2.rds.amazonaws.com',
          database: 'iradb',
          port: 3306
        };
}


//  options.socketPath = `/cloudsql/${config.get('INSTANCE_CONNECTION_NAME')}`;

const connection = mysql.createConnection(options);

connection.connect(function(err) {
      if (err) {
            console.error('error connecting: ' + err.stack);
            return;
      } else {
            console.log('connected as id ' + connection.threadId+"to ");
      }
});


module.exports = {
  getAllEntities: getAllEntities,
  getAllTransactions: getAllTransactions,
  getOwnershipForEntity: getOwnershipForEntity,
  getEntityDetails: getEntityDetails,
  getDealDetails: getDealDetails,
  insertEntity: insertEntity,
  insertTransaction: insertTransaction,
  getEntitiesByTypes: getEntitiesByTypes,
  getEntityTypes: getEntityTypes,
  getTransactionTypes: getTransactionTypes
  //getTransactionsForInvestment: getTransactionsForInvestment

};





//  ================  Functions =====================

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





//owneship: parent_entity_id, child_entity_id, capital_pct
function getEntityDetails (entity_id) {
  let queryString = 'SELECT * from entities'
  + ' WHERE id ='+entity_id;
      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            if (!results[0]) {
                                    fail("No such entity, sorry")
                            }

                            console.log ("Success - The found entity "+results[0].name +"\n")
                            succeed(results[0])
                      }
              }); //connection
      }); //promise
} // function



//owneship: parent_entity_id, child_entity_id, capital_pct
function getDealDetails (deal_id) {
  let queryString = 'SELECT * from deals'
  + ' WHERE id ='+deal_id+' ORDER BY id';

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




//owneship: parent_entity_id, child_entity_id, capital_pct
function getOwnershipForEntity (child_id) {
  let queryString = 'SELECT o.id, investor.name as investor_name, investment.name as investment_name, passthru.name as passthru_name,'
  + ' DATE_FORMAT(t.wired_date, "%b %d %Y") as wired_date, t.amount as amount, t.id as t_id,'
  + ' TRUNCATE(o.capital_pct,2) as capital_pct FROM ownership as o'
  + ' JOIN entities as investment ON investment.id = o.child_entity_id'
  + ' JOIN entities as investor ON investor.id = o.parent_entity_id'
  + ' JOIN transactions as t ON t.id = o.transaction_id'
  + ' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id'
  + ' WHERE o.child_entity_id ='+child_id+' ORDER BY amount DESC';

      return new Promise(function(succeed, fail) {
            connection.query(queryString,
              function(err, results) {
                      if (err) {
                            console.log ("Cant find ownership "+err)
                            fail(err)
                      } else {
                            console.log ("Ownership query OK got "+results.length)
                            //console.log ("The results are:"+JSON.stringify(results))
                            // if (results.length<1) {
                            //           fail("no ownership data")
                            // }
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function


function getEntitiesByTypes(wantedTypes) {
      let queryString =
      'SELECT e.id as id, t.name as entity_type, e.name as name, e.taxid as taxid FROM entities as e'
        + ' JOIN entity_types as t ON t.type_num = e.type'
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


function getAllEntities() {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT e.id as id, t.name as entity_type, e.name as name, e.taxid as taxid FROM entities as e'
            +' JOIN entity_types as t ON t.type_num = e.type',
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function



function getAllTransactions () {
      return new Promise(function(succeed, fail) {
            connection.query(
            //  'SELECT * from transactions',
              'SELECT t.id as id, investment.name as investment_name, investor.name as investor_name, passthru.name as passthru_name, t.trans_type as t_type, DATE_FORMAT(t.wired_date, "%b %d %Y") as t_wireddate, TRUNCATE(t.amount,2) as t_amount, t.notes as t_notes FROM transactions as t'
                  +' JOIN entities as investment ON investment.id = t.investment_entity_id'
                  +' JOIN entities as investor ON investor.id = t.investor_entity_id'
                  +' LEFT JOIN entities as passthru ON passthru.id = t.passthru_entity_id',

              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function




// transactions
// (investor_entity_id,  investment_entity_id,  passthru_entity_id,  trans_type, wired_date, amount, notes)


//not live yet
function getTransactionsForInvestment (investment_entity) {
      return new Promise(function(succeed, fail) {
            connection.query(
              'SELECT * from transactions WHERE investment_entity_id = ?', investment_entity,
              function(err, results) {
                      if (err) {
                            fail(err)
                      } else {
                            succeed(results)
                      }
              }); //connection
      }); //promise
} // function


//
//
//
//
//
//
//
//
//
// function authuser (email, password, done) {
//   connection.query(
//     'SELECT * FROM users WHERE email = ?', email,  (err, results) => {
//       if (!err && !results.length) {
//               done("Not found "+ email+" got "+err, null);
//               return;
//       }
//
//       if (err) {
//         done("Search error" +err, null);
//         return;
//       }
//
//      let checkPlainPW = (password === results[0].password)
//      //res is result of comparing encrypted apsswords
//      bcrypt.compare(password, results[0].password, function(err, res) {
//                    if (err) {
//                      console.log("PW auth error" +err)
//                      done("PW auth error" +err, null);
//                      return;
//                    }
//                   if (!(checkPlainPW) && !(res) ) {
//                       console.log("\nbad pw "+password+", res is: "+res+"   checkPlainPW is: "+checkPlainPW)
//                       done("bad password", null)
//                       return
//                   }
//                 console.log(results[0].firstname+" has authed in authuser");
//                 done(null, results[0]);
//     }); //chaeckHashPW
//   } //cb function
//  ) //connection querty
// } //authuser
//
//
// function updateuser (updateuser, done) {
//     console.log("\n\nHere at update: email:"+ updateuser.email +" PW:"+updateuser.password+" ID:"+updateuser.id)
//     connection.query(
//         'UPDATE users SET email = ?, photo =?, password=? WHERE id=?',
//         [updateuser.email, updateuser.photo, updateuser.password, updateuser.id],
//         function(err, status)  {
//                 if (err) {
//                   done(err, null);
//                   return;
//                 }
//                 done(null, status.affectedRows);
//     }); //connection.query
//   } //updateuser
//
//
//
//
//
// function finduser (email, cb) {
//   connection.query(
//     'SELECT * FROM users WHERE email = ?', email,  (err, results) => {
//       if (!err && !results.length) {
//               cb("Not found "+ email+" got "+err);
//               return;
//       }
//
//       if (err) {
//         cb("Search error" +err);
//         return;
//       }
//       cb(null, results[0]);
//     });
// }
//
// function getportfoliolist (user_id, done) {
//   connection.query(
//     'SELECT u.firstname, u.lastname, p.address, p.zip, p.id, p.units, i.ownership from investments as i'
//     +' JOIN users as u ON u.id = i.user_id'
//     +' JOIN reprops as p ON p.id = i.prop_id WHERE user_id = ?',user_id,
//     function(err, results)  {
//               if (err) {
//                 done(err, null);
//                 return;
//               }
//               done(null, results);
//     }
//   );
// }
//
// function getportfoliopromise (user_id) {
//       return new Promise(function(succeed, fail) {
//             connection.query(
//               'SELECT u.firstname, u.lastname, p.address, p.zip, p.id, p.units, i.ownership from investments as i'
//               +' JOIN users as u ON u.id = i.user_id'
//               +' JOIN reprops as p ON p.id = i.prop_id WHERE user_id = ?',user_id,
//               function(err, results)  {
//                         if (err) {
//                               fail(err)
//                         } else {
//                               succeed(results)
//                         }
//               }) //connection
//       }); //promise
// } //function
//
//
// function getallinvestorspromise () {
//       return new Promise(function(succeed, fail) {
//             connection.query(
//               'SELECT u.id, u.firstname, u.lastname, u.email, u.photo'
//               +' from users as u WHERE u.access < 4',
//               function(err, results) {
//                       if (err) {
//                             fail(err)
//                       } else {
//                             succeed(results)
//                       }
//               }); //connection
//       }); //promise
// } // function getallinvestorspromise
//
//
// // [START get allinvestors]
// function getallinvestors (cb) {
//   connection.query(
//     'SELECT u.id, u.firstname, u.lastname, u.email, u.photo'
//     +' from users as u WHERE u.access < 4',  function(err, results) {
//               if (err) {
//                 cb(err);
//                 return;
//               }
//               cb(null, results);
//     }
//   );
// }
//
//
//
//
// function getinvestorlist (property_id, done) {
//      connection.query(
//         'SELECT u.id as user_id, u.firstname, u.lastname, i.ownership as ownership, u.photo  from investments as i'
//         +' JOIN users as u ON u.id = i.user_id'
//         +' JOIN reprops as p ON p.id = i.prop_id WHERE prop_id = ?',property_id,
//         function(err, results)  {
//                   if (err) {
//                     done(err, null);
//                     return;
//                   }
//                   done(null, results);
//      });//connectionquery
// } //getinvestorlist
//
//
//
//
// // [START get allprops]
// function getallprops (cb) {
//   connection.query(
//     'SELECT * FROM reprops',  function(err, results) {
//               if (err) {
//                 cb(err);
//                 return;
//               }
//               //const hasMore = false;
//               //wow, you just invoke the CB function to return results
//               cb(null, results, false);
//     }
//   );
// }
//
//
//
//
// // [START create]
// function create (data, cb) {
//   console.log("the new property is: "+JSON.stringify(data))
//   connection.query('INSERT INTO reprops SET ?', data, (err, res) => {
//     if (err) {
//       console.log("bad insert"+err)
//       cb(err);
//       return;
//     }
//
//    read(res.insertId, cb);
//
//   });
// }
// // [END create]
//
// function  _delete (id, cb) {
//   connection.query('DELETE FROM reprops WHERE id = ?', id, (err, results) => {
//       if (err) {
//         console.log("bad delete "+err)
//         cb(err);
//         return;
//       }
//       console.log("Delete results in model are: "+JSON.stringify(results))
//       cb(null, results)
//   });
//
// }
//
//
// function read (id, cb) {
//   connection.query(
//     'SELECT * FROM reprops WHERE id = ?', id,  (err, results) => {
//       if (!err && !results.length) {
//         err = {
//           code: 404,
//           message: 'Id '+id+' not found in Listings'
//         };
//       }
//
//       if (err) {
//         cb("Search error" +err);
//         return;
//       }
//       cb(null, results[0]);
//     });
// }
