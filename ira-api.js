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

module.exports = api;


// =============== API ===============

api.get('/api/getdeals/', (req, res, next) => {
          api_searchEntities().catch(err => {
                console.log("API search Entity problem: "+err);
          })

      async function api_searchEntities() {
            try {

                  var entList = await iraSQL.getEntitiesByTypes([1]);
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








api.get('/api/searchentities/:term', (req, res, next) => {
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

api.get('/api/searchentities/', (req, res, next) => {

          res.send("[]");
}); //route




api.get('/api/transforentity/:id', (req, res, next) => {
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


                        return cleanTransaction;
            });
            res.send(JSON.stringify(cleanTransactions,null,3));

    }; //async function

}); //route
