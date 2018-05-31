








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
     bcrypt.compare(password, results[0].password, function(err, res) {
                   if (err) {
                     console.log("PW auth error" +err)
                     done("PW auth error" +err, null);
                     return;
                   }
                  if (!(checkPlainPW) && !(res) ) {
                      console.log("\nbad pw "+password+", res is: "+res+"   checkPlainPW is: "+checkPlainPW)
                      done("bad password", null)
                      return
                  }
                console.log(results[0].firstname+" has authed in authuser");
                done(null, results[0]);
    }); //chaeckHashPW
  } //cb function
 ) //connection querty
} //authuser


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
