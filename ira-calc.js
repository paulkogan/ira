


const hbs = require('hbs');
const iraSQL =  require('./ira-model');

module.exports = {
  formatCurrency:formatCurrency,
  parseFormAmountInput:parseFormAmountInput,
  doTransMatchForRollup: doTransMatchForRollup,
  totalupInvestors:totalupInvestors,
  totalupCashInDeal:totalupCashInDeal,
  totalupInvestorPortfolio: totalupInvestorPortfolio,
  calculateOwnership : calculateOwnership,
  calculateDeal: calculateDeal
}


function formatCurrency (amount) {
            if (amount >= 0) {
               return "$"+amount.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
            } else {
               return "($"+(-1*amount).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")+")";
            }
} //function


function parseFormAmountInput (fieldInput) {
    return fieldInput.replace(/(,|\$|\%)/g,"")
}


function doTransMatchForRollup (tt1,tt2) {
        if ( (tt1 === tt2) ||  (tt1 === 1 && tt2 ===5) ||(tt1 === 5 && tt2 ===1) ){
              return true;
        } else {
              return false;
        }

}



//FOR DISPLAY - got wonership rows, mith multiples for each wire
function totalupInvestors (investors) {
      console.log("\nTUI Found "+investors.length+" transaction rows")
      let expandInvestors = []
      let totalCapital = 0;
      let totalCapitalPct =0.0000;

      for (let index = 0; index < investors.length; index++) {
            let alreadyExists = false

            //check if
            for (let j = 0; j < expandInvestors.length; j++) {
                    //console.log("about to check trans "+index+" and expand-own "+j+"");

                    if (expandInvestors[j].id === investors[index].id) {

                            if (investors[index].t_type === 5 || expandInvestors[j].wired_date === "Multiple trans & own. adjust.") {
                                        expandInvestors[j].wired_date = "Multiple trans & own. adjust."

                            } else {

                                        expandInvestors[j].wired_date = "Multiple transactions"
                            }


                            console.log("\nTUI - rolling up transaction: "+index+" to ownership: "+j+" with wire date "+expandInvestors[j].wired_date+ " --  "+JSON.stringify(investors[index])+"  \n");
                            alreadyExists = true
                    } //if
                    if (alreadyExists) break;
            }  //for loop checking existing own rows

            if (!alreadyExists) {  //not a duplicate -- not adding sequentially
                    let newOwnRow =  investors[index]
                    totalCapital += investors[index].amount;
                    totalCapitalPct += investors[index].capital_pct;
                    newOwnRow.formattedAmount = formatCurrency(investors[index].amount)
                    expandInvestors.push(newOwnRow)
                    console.log("\nTUI - NEW own_row: "+(expandInvestors.length-1)+" from transaction: "+index+"  :" +JSON.stringify(newOwnRow)+"  \n");

            } //if not a dupe

      }//for index --- all own rows with transactions
      console.log("in TotalUpInvestors sending: " +totalCapitalPct+"%  ");
      return [expandInvestors, formatCurrency(totalCapital), totalCapitalPct.toFixed(2)];
  } //function



  async function totalupCashInDeal (transactions) {
        let expandTransactions = transactions
        let totalCashInDeal = 0.0;
        let dealDistributions = 0.0

        for (let index = 0; index < transactions.length; index++) {

                totalCashInDeal += expandTransactions[index].t_amount
                if(transactions[index].tt_id === 5 ) {
                        expandTransactions[index].formatted_amount = transactions[index].t_own_adj+"%";
                } else {
                        expandTransactions[index].formatted_amount = formatCurrency(expandTransactions[index].t_amount)
                }
                if(transactions[index].tt_id === 3 ) {
                      dealDistributions += expandTransactions[index].t_amount
                }

        } //for

        console.log ("TotalUPCash -- for deal/entity "+transactions[0].investment_name+" is "+ totalCashInDeal+"and TotalDistributions is "+dealDistributions+"\n\n")
        return [expandTransactions, formatCurrency(totalCashInDeal), dealDistributions];

    } //function totalupCashInDeal


// these are Ownership Rows
    async function totalupInvestorPortfolio (investments) {
          let portfolioDeals = []  //empty array - add only if its a deal
          let totalPortfolioValue = 0;
          let totalInvestmentValue = 0;
          let totalDistributions = 0;

          for (let index = 0; index < investments.length; index++) {

               if (investments[index].deal_id) {
                             let deal = await iraSQL.getDealById(investments[index].deal_id);
                             let expandDeal = calculateDeal(deal[0])
                             console.log (index+") Investment for ENTITY_ID :"+investments[index].investment_id+" - "+investments[index].investment_name+"\n")
                             let transactionsForDeal = await iraSQL.getTransactionsForInvestorAndEntity(investments[index].investor_id, investments[index].investment_id,[1,3,5,6]);
                             console.log ("TU Inv.Portfolio - got "+transactionsForDeal.length+" transactions for deal "+index+"  : "+JSON.stringify(transactionsForDeal, null, 4)+"\n")

                             let result = await totalupCashInDeal(transactionsForDeal);
                             //first copy the deal basics
                             let newPortfolioDeal = investments[index];
                             newPortfolioDeal.expandDeal = expandDeal;
                             newPortfolioDeal.transactionsForDeal = result[0];
                             newPortfolioDeal.totalCashInDeal = result[1];
                             newPortfolioDeal.dealDistributions = result[2];
                             newPortfolioDeal.investor_equity_value = newPortfolioDeal.expandDeal.equity_value*(newPortfolioDeal.capital_pct/100);

                             //add the sums
                             totalPortfolioValue += newPortfolioDeal.investor_equity_value
                             totalInvestmentValue += newPortfolioDeal.amount;
                             totalDistributions += newPortfolioDeal.dealDistributions;
                             newPortfolioDeal.formatted_amount = formatCurrency(newPortfolioDeal.amount)
                             newPortfolioDeal.formatted_deal_equity_value = formatCurrency(newPortfolioDeal.expandDeal.equity_value)
                             newPortfolioDeal.formatted_investor_equity_value = formatCurrency(newPortfolioDeal.investor_equity_value)
                             portfolioDeals.push(newPortfolioDeal);
              } else {


                            // if its an ENTITY do it here
                            //dont add to array of portfolioDeals
                            console.log ("\n"+index+") Investment for ENTITY_ID :"+investments[index].investment_id+" "+investments[index].investment_name+" is not a DEAL \n")
                            let transactionsForEntity = await iraSQL.getTransactionsForInvestorAndEntity(investments[index].investor_id, investments[index].investment_id,[1,3,5,6]);
                            console.log ("TUIP - got "+transactionsForEntity.length+" transactions for entity "+investments[index].investment_name+"  : "+JSON.stringify(transactionsForEntity, null, 4)+"\n")


                            //adding a dummy deal
                            let expandDeal =  {
                                       "id": investments[index].id,
                                       "name": investments[index].investment_name,
                                       "aggregate_value": 0,
                                       "cash_assets": 0,
                                       "aggregate_debt": 0,
                                       "deal_debt": 0,
                                       "notes": "",
                                       "equity_value": 0,
                                       "total_value": 0,
                                       "total_debt": 0,
                                       "formatted_total_value": "$0",
                                       "formatted_total_debt": "$0",
                                       "formatted_aggregate_value": "$0",
                                       "formatted_cash_assets": "$0",
                                       "formatted_aggregate_debt": "$0",
                                       "formatted_deal_debt": "$0",
                                       "formatted_equity_value": "$0"
                            };
                            let newPortfolioDeal = investments[index];
                            newPortfolioDeal.expandDeal = expandDeal;


                            let result = await totalupCashInDeal(transactionsForEntity);

                            newPortfolioDeal.transactionsForDeal = result[0];
                            newPortfolioDeal.totalCashInDeal = result[1];
                            newPortfolioDeal.dealDistributions = result[2];
                            newPortfolioDeal.investor_equity_value = newPortfolioDeal.expandDeal.equity_value*(newPortfolioDeal.capital_pct/100);

                            //add the sums
                            totalPortfolioValue += newPortfolioDeal.investor_equity_value
                            totalInvestmentValue += newPortfolioDeal.amount;
                            totalDistributions += newPortfolioDeal.dealDistributions;
                            newPortfolioDeal.formatted_amount = formatCurrency(newPortfolioDeal.amount)
                            newPortfolioDeal.formatted_deal_equity_value = formatCurrency(newPortfolioDeal.expandDeal.equity_value)
                            newPortfolioDeal.formatted_investor_equity_value = formatCurrency(newPortfolioDeal.investor_equity_value)
                            portfolioDeals.push(newPortfolioDeal);



              }

               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for
        return [portfolioDeals, totalInvestmentValue, totalPortfolioValue, totalDistributions];
    } //function




  function calculateOwnership (transactionsFromEntity) {
        var inv_trans_Rows = transactionsFromEntity
        var totalCapital = 0;
        var totalAdjOwnPct = 0
        var totalOwnPct = 0
        console.log("In CalculateOwnership, here are "+transactionsFromEntity.length+" transcations :"+JSON.stringify(transactionsFromEntity,null,4)+"\n\n")

        for (let index = 0; index < inv_trans_Rows.length; index++) {
               totalCapital += inv_trans_Rows[index].t_amount;
               totalAdjOwnPct += inv_trans_Rows[index].t_own_adj;
               //add each investor to a table. If he's there before,

        }
        console.log("In CalculateOwnership, the TotaCap is "+totalCapital+"\n")


       //Math.round((totalAdjOwnPct*1000)/1000).toFixed(4)
       let availPct_after_OwnAdj = (100-totalAdjOwnPct)/100
       //console.log("\nIn CalculateOwnership, Adust Onership % is "+totalAdjOwnPct+" and remaining % as decimal is "+availPct_after_OwnAdj+" \n")

        // now calculate % for each
        for (let index = 0; index < inv_trans_Rows.length; index++) {
                if(inv_trans_Rows[index].t_own_adj > 0) {  //if its an ownership adjustment (% only)
                      inv_trans_Rows[index].percent = (inv_trans_Rows[index].t_own_adj)/100
                } else {
                      // if (inv_trans_Rows[index].tt_id === 6) {  //its an offset
                      //           inv_trans_Rows[index].percent = 0
                      // }  else {
                      inv_trans_Rows[index].percent = ((inv_trans_Rows[index].t_amount/totalCapital)*availPct_after_OwnAdj)

                      //} //if not a n offset
                } //if its ownership %

               totalOwnPct += inv_trans_Rows[index].percent*100
              // console.log("\nIn CalculateOwnership, after: "+inv_trans_Rows[index].id + "the % total is "+  totalOwnPct+"\n");
               inv_trans_Rows[index].formattedPercent = (inv_trans_Rows[index].percent*100).toFixed(4)+"%"
               inv_trans_Rows[index].formattedAmount = formatCurrency(inv_trans_Rows[index].t_amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].formattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [inv_trans_Rows, totalCapital, totalAdjOwnPct, totalOwnPct];
    } //function


  function calculateDeal (deal) {
        //console.log("\nin CalculateDeal, Deal is  "+JSON.stringify(deal));
         let expandDeal = deal
         //expandDeal.equity_value = 999
         //expandDeal.equity_value = expandDeal.aggregate_value
         expandDeal.equity_value = expandDeal.aggregate_value+expandDeal.cash_assets-expandDeal.deal_debt-expandDeal.aggregate_debt
         expandDeal.total_value = expandDeal.aggregate_value + expandDeal.cash_assets
         expandDeal.total_debt = expandDeal.aggregate_debt + expandDeal.deal_debt
         expandDeal.formatted_total_value = formatCurrency(expandDeal.aggregate_value + expandDeal.cash_assets)
         expandDeal.formatted_total_debt = formatCurrency(expandDeal.aggregate_debt + expandDeal.deal_debt)
         expandDeal.formatted_aggregate_value = formatCurrency(expandDeal.aggregate_value)
         expandDeal.formatted_cash_assets = formatCurrency(expandDeal.cash_assets)
         expandDeal.formatted_aggregate_debt = formatCurrency(expandDeal.aggregate_debt)
         expandDeal.formatted_deal_debt  = formatCurrency(expandDeal.deal_debt)
         expandDeal.formatted_equity_value =formatCurrency(expandDeal.equity_value)
        //console.log("\nin CalculateDeal, expandDeal is  "+JSON.stringify(expandDeal));
        return expandDeal;
    } //function



    hbs.registerHelper('ifEqual', function(v1, v2, options) {
              if(v1 === v2) {
                  return options.fn(this);
              }
              return options.inverse(this);

    });

    hbs.registerHelper('ifLessThan', function(v1, v2, options) {
              if(v1 < v2) {
                  return options.fn(this);
              }
              return options.inverse(this);

    });

    hbs.registerHelper('ifGreaterThan', function(v1, v2, options) {
              if(v1 > v2) {
                  return options.fn(this);
              }
              return options.inverse(this);

    });

    hbs.registerHelper('ifIncludes', function(v1, v2, options) {
              if(v1.toString().includes(v2)) {
                  return options.fn(this);
              }
              return options.inverse(this);

    });
