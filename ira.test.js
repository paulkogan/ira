const assert = require('assert');
const iraSQL =  require('./ira-model');
const app =  require('./ira');
const calc =  require('./ira-calc');
const menus = require('./ira-menus.js');
var transactions = []

beforeEach(async function () {
        transactions = await iraSQL.getAllTransactions();

});


describe("IRA - Tests: ..........", function () {


      it("finds some transcations", async function(){
           assert.ok(transactions.length >0)
      });


      //
      // it("add a transaction", async function(){
      //       var newTransaction = {
      //                 "trans_type":"3",
      //                 "investment_entity_id":"2",
      //                 "investor_entity_id":"5",
      //                 "passthru_entity_id":"",
      //                 "amount":-8000,
      //                 "own_adj":0,
      //                 "wired_date":"2018-07-01",
      //                 "notes":"testing distribution with Noah"
      //     };
      //     await iraSQL.insertTransaction(newTransaction);
      //     var newTransactions = await iraSQL.getAllTransactions();
      //     assert.equal(transactions.length, newTransactions.length-1)
      //
      // });
      //
      //
      //
      //
      //
      // it("increases portfolioCashGain by amount of a distribution", async function(){
      //      let investorID = 5
      //      let testAmount = 36
      //
      //      //get the BEFORE data
      //      let investments = await iraSQL.getOwnershipForInvestor(investorID);
      //      let results = await calc.totalupInvestorPortfolio(investments)
      //      let portfolioDeals = results[0]
      //      let totalInvestmentValue =  results[1]
      //      let totalPortfolioValue =  results[2]
      //      let totalDistributions =  results[3]*-1 //make it positive here
      //      let portfolioValueGain =  totalPortfolioValue-totalInvestmentValue
      //
      //      let portfolioCashGain1 = portfolioValueGain+ totalDistributions
      //
      //       var newTransaction = {
      //                 "trans_type":"3",
      //                 "investment_entity_id":"2",
      //                 "investor_entity_id": investorID,
      //                 "passthru_entity_id":"",
      //                 "amount": testAmount*-1,
      //                 "own_adj":0,
      //                 "wired_date":"2018-07-01",
      //                 "notes":"testing distribution with Noah"
      //     };
      //     let savedData = await iraSQL.insertTransaction(newTransaction);
      //     console.log("\nin TEST Added transaction no. "+savedData.insertId);
      //
      //     //now get the AFTER data
      //     investments = await iraSQL.getOwnershipForInvestor(investorID);
      //     results = await calc.totalupInvestorPortfolio(investments)
      //     portfolioDeals = results[0]
      //     totalInvestmentValue =  results[1]
      //     totalPortfolioValue =  results[2]
      //     totalDistributions =  results[3]*-1 //make it positive here
      //     portfolioValueGain =  totalPortfolioValue-totalInvestmentValue
      //     let portfolioCashGain2 = portfolioValueGain+ totalDistributions
      //
      //     let changeInPortfolioCash = portfolioCashGain2 - portfolioCashGain1
      //     assert.equal(changeInPortfolioCash,testAmount)
      //
      // });

      it("returns good Ownership % ForInvestorAndEntity", async function ()  {
            let investor_id = 5;  //Noah getTransactionsForInvestment
            let entity_id = 15; //507 east 6
            let expected_pct = "4.1250"
            let results = await iraSQL.getOwnershipForInvestorAndEntity(entity_id, investor_id);
            //console.log ("The results are:"+JSON.stringify(results, null,4))
            console.log ("Expected: "+expected_pct+" Actual: "+ results[0].capital_pct);
            assert.equal(expected_pct, results[0].capital_pct)

      });

//let inv_equity_value =

// it("returns good InvestorEquityValueInDeal", async function ()  {
//         let investor_id = 5;  //Noah getTransactionsForInvestment
//         let entity_id = 15; //507 east 6
//         //Deal Equity Value has to be $20,985,000
//         let expected_value = "865631"
//         let results = await calc.getInvestorEquityValueInDeal(investor_id, entity_id);
//         let inv_equity_value = Math.round(results[0])
//         let inv_pct_own = results[1]
//         console.log ("Expected: "+expected_value+" Actual: "+ inv_equity_value);
//         assert.equal(expected_value, inv_equity_value)
//
//   });



  it("increases investor_equity_value proportionate to ownership when deal cash_assets increase", async function(){

          let investor_id = 5;  //Noah getTransactionsForInvestment
          let entity_id = 15; //507 east 6
          let increase_in_assets = 1000000

          let results = await calc.getInvestorEquityValueInDeal(investor_id, entity_id);
          let before_equity_value = Math.round(results[0])
          let pct_own = results[1]
          let expected_portfolio_increase  = (pct_own/100)*increase_in_assets;
          console.log("\nTEST: ready with inputs,   % own is:"+pct_own+" and Expected Increase is: "+expected_portfolio_increase+"\n\n");


          let foundEntity = await iraSQL.getEntityById(entity_id);
          let deal_id = foundEntity.deal_id
          let deal = await iraSQL.getDealById(deal_id);
          let updatedDeal = deal[0];
          updatedDeal.cash_assets = deal[0].cash_assets*1 + increase_in_assets;
          console.log("\nTEST - Updated deal, ready to send to SQL  "+JSON.stringify(updatedDeal)+"\n\n");
          let updateDealResults = await iraSQL.updateDeal(updatedDeal);

          results = await calc.getInvestorEquityValueInDeal(investor_id, entity_id);
          let after_equity_value = Math.round(results[0])
          console.log ("Before Value: "+before_equity_value+" After Value: "+ after_equity_value);
          let actualIncreaseInEquityValue = after_equity_value - before_equity_value;
          console.log ("Expected: "+expected_portfolio_increase+" Actual Increase in Value: "+ Math.round(actualIncreaseInEquityValue));
          assert.equal(expected_portfolio_increase, actualIncreaseInEquityValue)

  });

        //get investor ownership for investor, entity
        //edit deal to increase cash_assets
        //get investor_equity_value AFTER for investor and deal ==> new function
        //assert (AFTER - BEFORE = cash_assets_increase * ownership stake)
      //  });


}); //describe
