
'use strict';

const express = require('express');
const appRouter = express.Router();

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })

//const config = require('./propxxx3config');
//const extend = require('lodash').assign;
const mysql = require('mysql');
const calc =  require('./ira-calc');
const iraSQL =  require('./ira-model');
const menus = require('./ira-menus.js');



// const bcrypt = require('bcrypt');
// const crypto            = require('crypto');

const passport          = require('passport');
const LocalStrategy     = require('passport-local').Strategy;
const cookieParser = require('cookie-parser')
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const secret = "cat"

// appRouter.use(cookieParser(secret));
// appRouter.use(bodyParser.urlencoded({extended: true}))
// appRouter.use(bodyParser.json());
//
// appRouter.use(session({
//     cookieName: 'appRouter3sess',
//     secret: secret,
//     resave: true,
//     //store: RedisStore,
//     saveUninitialized: true,
//     cookie : { httpOnly: true, expires: 60*60*1000 }
// }));
// appRouter.use(passport.initialize());
// appRouter.use(passport.session());

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

module.exports = appRouter;

// module.exports = {
//   appRouter,
//   authuser,
//   updateuser,
//   finduser
// };

//functions ==============




function authuser (email, password, done) {
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
     //res is result of comparing encrypted apsswords
      if (checkPlainPW) {
        console.log(results[0].firstname+" has authed in authuser");
        done(null, results[0]);

      } else {
          console.log("\nbad pw "+password+",  checkPlainPW is: "+checkPlainPW)
          done("bad password", null)

      }




    //  bcrypt.compare(password, results[0].password, function(err, res) {
    //                if (err) {
    //                  console.log("PW auth error" +err)
    //                  done("PW auth error" +err, null);
    //                  return;
    //                }
    //               if (!(checkPlainPW) && !(res) ) {
    //                   console.log("\nbad pw "+password+", res is: "+res+"   checkPlainPW is: "+checkPlainPW)
    //                   done("bad password", null)
    //                   return
    //               }
    //             console.log(results[0].firstname+" has authed in authuser");
    //             done(null, results[0]);
    // }); //bcrypt

  } //cb function
 ) //connection querty
} //authuser


function updateuser (updateuser, done) {
    console.log("\n\nHere at update: email:"+ updateuser.email +" PW:"+updateuser.password+" ID:"+updateuser.id)
    connection.query(
        'UPDATE users SET email = ?, photo =?, password=? WHERE id=?',
        [updateuser.email, updateuser.photo, updateuser.password, updateuser.id],
        function(err, status)  {
                if (err) {
                  done(err, null);
                  return;
                }
                done(null, status.affectedRows);
    }); //connection.query
  } //updateuser





function finduser (email, cb) {
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



//==========
appRouter.get('/logout', function(req, res, next){
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


appRouter.get('/login', (req, res, next) => {
        res.render('login', {
                postendpoint: '/checklogin',
                message: req.flash('login')
        });
});



//grab info, call strategy
appRouter.post('/checklogin', function(req, res, next) {
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




//========== passport STRATEGY =========
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
                        return done(null, false);
                 }
                 console.log("OK autheduser is "+autheduser.firstname);
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
