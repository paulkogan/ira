const assert = require('assert');
const iraSQL2 =  require('./ira-model');
const ira =  require('../ira');
const actions =  require('./ira-actions');
const calc =  require('./ira-calc');
const menus = require('./ira-menus.js');
//var transactions = []

beforeEach(async function () {

});

afterEach(async function () {

});

after( async function () {
      // await ira.shutDownServer();
      // console.log("Shut down OK \n")
});




describe("IRA - Tests 2: ..........", async function () {


      it("finds some transcations", async function(){
           let transactions = await iraSQL2.getAllTransactions();
           assert.ok(transactions.length >0)
      });




          it("finds an Entity by ID", async function(){
              let trialID = 19
              let foundEntity = await iraSQL2.getEntityById(trialID);
               assert.ok(foundEntity.id === trialID)
          });



      it("adds a transaction", async function(){
            let transactions = await iraSQL2.getAllTransactions();
            var newTransaction = {
                      "trans_type":"3",
                      "investment_entity_id":"2",
                      "investor_entity_id":"5",
                      "passthru_entity_id":"",
                      "amount":-8000,
                      "own_adj":0,
                      "wired_date":"2018-07-01",
                      "notes":"testing distribution with Noah"
          };
          let savedData = await iraSQL2.insertTransaction(newTransaction);
          //console.log("\nin TEST Add a T - Added transaction no. "+savedData.insertId);
          var newTransactions = await iraSQL2.getAllTransactions();
          assert.equal(transactions.length, newTransactions.length-1)

      });

  //return [portfolioDeals, totalInvestmentValue, totalPortfolioValue, totalDistributions];
      it("can calculate portfolio Value", async function(){
                let investorID = 5;
                let expectedValue = 11636330;
                let formattedValue = calc.formatCurrency(expectedValue)
                let results = await calc.totalupInvestorPortfolio(investorID)
                console.log("Noah's investor portfolio is: "+JSON.stringfy(results,null,4) )
                //let portfolioDeals = results[0]
                let totalInvestmentValue =  results[1]
                let totalPortfolioValue =  results[2]
                let totalDistributions =  results[3]*-1 //make it positive here
                let portfolioValueGain =  totalPortfolioValue-totalInvestmentValue

                let portfolioCashGain1 = portfolioValueGain+ totalDistributions
                console.log("noah's portfolio cash gain is: "+portfolioCashGain1 )
                assert.equal(changeInPortfolioCash,expectedValue)

      });





      it("increases portfolioCashGain by amount of a distribution", async function(){
           let investorID = 5; //Noah
           let testAmount = 36;
           let investment_entityID = 2; //350 Broadway

           //get the BEFORE data - how much has noah  made in profit

           let results = await calc.totalupInvestorPortfolio(investorID)
           let portfolioDeals = results[0]
           let totalInvestmentValue =  results[1]
           let totalPortfolioValue =  results[2]
           let totalDistributions =  results[3]*-1 //make it positive here
           let portfolioValueGain =  totalPortfolioValue-totalInvestmentValue

           let portfolioCashGain1 = portfolioValueGain+ totalDistributions

           //let portfolioCashGain1 = 110636330
           console.log("noah's portfolio cash gain is: "+portfolioCashGain1 )

            //add a new Distribution transcation
            var newTransaction = {
                      "trans_type":"3", //distribution
                      "investment_entity_id":investment_entityID,
                      "investor_entity_id": investorID,
                      "passthru_entity_id":"",
                      "amount": testAmount*-1,
                      "own_adj":0,
                      "wired_date":"2018-07-01",
                      "notes":"testing distribution with Noah"
          };
          let savedData = await iraSQL2.insertTransaction(newTransaction);
          console.log("\nin TEST Added transaction no. "+savedData.insertId);

          ///now get the AFTER data
          investments = await iraSQL2.getOwnershipForInvestor(investorID);
          results = await calc.totalupInvestorPortfolio(investorID)
          portfolioDeals = results[0]
          totalInvestmentValue =  results[1]
          totalPortfolioValue =  results[2]
          totalDistributions =  results[3]*-1 //make it positive here
          portfolioValueGain =  totalPortfolioValue-totalInvestmentValue
          let portfolioCashGain2 = portfolioValueGain+ totalDistributions



          let changeInPortfolioCash = portfolioCashGain2 - portfolioCashGain1
          assert.equal(changeInPortfolioCash,testAmount)

      });

      it("returns good Ownership % ForInvestorAndEntity", async function ()  {
            let investor_id = 5;  //Noah getTransactionsForInvestment
            let entity_id = 15; //507 east 6
            let expected_pct = "4.1250"
            let results = await iraSQL2.getOwnershipForInvestorAndEntity(entity_id, investor_id);
            //console.log ("The results are:"+JSON.stringify(results, null,4))
            //console.log ("Expected: "+expected_pct+" Actual: "+ results[0].capital_pct);
            assert.equal(expected_pct, results[0].capital_pct)

      });


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


          let foundEntity = await iraSQL2.getEntityById(entity_id);
          let deal_id = foundEntity.deal_id
          let deal = await iraSQL2.getDealById(deal_id);
          let updatedDeal = deal;
          updatedDeal.cash_assets = deal.cash_assets*1 + increase_in_assets;
          console.log("\nTEST - Updated deal, ready to send to SQL  "+JSON.stringify(updatedDeal)+"\n\n");
          let updateDealResults = await iraSQL2.updateDeal(updatedDeal);

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
