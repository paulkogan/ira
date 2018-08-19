


const hbs = require('hbs');
const iraSQL =  require('./ira-model.js');
const j2csvParser = require('json2csv').parse;
let logIndent = 0
const indentChar = "___"

module.exports = {
  formatCurrency,
  parseFormAmountInput,
  doTransMatchForRollup,
  totalupInvestors,
  totalupCashInDeal,
  totalupInvestorPortfolio,
  calculateOwnership,
  calculateDeal,
  calcInvEntityImpliedValue,
  updateValueofInvestorsUpstream,
  getInvestorEquityValueInDeal,
  getCapCallDetails,
  createCSVforDownload
}



async function getCapCallDetails(capCallId) {

            let foundCapCall = await iraSQL.getCapitalCallById(capCallId);
            let capCallTransactions = await iraSQL.getTransactionsForCapitalCall (foundCapCall.id, [8]);
            //console.log("In calc - Capp Call transactions are: "+JSON.stringify(capCallTransactions,null,4))

            let dealEntity = await iraSQL.getEntityById(foundCapCall.deal_entity_id);

            let totalRaised = capCallTransactions.reduce((total, item) => {
                  return total + item.t_amount;
              }, 0);

            console.log("In calc, for CC: "+capCallId+ " totalRaised is: "+totalRaised)

            return [foundCapCall, capCallTransactions, dealEntity, totalRaised]

} //async function






// Iterative function - writes to Log
async function updateValueofInvestorsUpstream (entity_id) {
            let outputLog = [] //should be shareable
            try {
               let updatedEntity = await iraSQL.getEntityById(entity_id);
               console.log("======== NOW STARTING UPDATE CYCLE for "+updatedEntity.name+"\n")
               outputLog.push({entry:(indentChar.repeat(logIndent))+" === STARTING UPDATE CYCLE for "+updatedEntity.name+" ==="});

               //this is for showing contributions
               if (updatedEntity.type != 1) {  //if not a deal
                        let results = await calcInvEntityImpliedValue(updatedEntity.id);
                        let newImpliedValue = results[0];
                        outputLog.push({entry: (indentChar.repeat(logIndent))+" updated entity Equity Value is: "+formatCurrency(newImpliedValue) })
                        console.log("NewImpliedValue in calc/Upstream Results is  "+newImpliedValue);
                        let portfolioDeals = results[1];
                        //console.log("Showing value contributions for "+investors[i].investor_name + " here are the PortfolioDeals "+JSON.stringify(portfolioDeals,null,4))

                        //if you have investments/contributors to the EV
                        logIndent +=2
                        if (isIterable(portfolioDeals)) {
                        // show components of entity value
                                for (let deal of portfolioDeals) {
                                     outputLog.push({entry: (indentChar.repeat(logIndent))+" "+formatCurrency(deal.investor_equity_value)+ "  from a "+deal.capital_pct.toFixed(2)+"% interest in "+deal.investment_name })
                                 }

                         } else {
                              console.log("portfolioDeals not Iterable");
                         }
                         logIndent -=2

                 } else {
                      // LAME ! - if its not a deal, then you assume the entity already has it.
                      outputLog.push({entry:(indentChar.repeat(logIndent))+" updated deal Equity Value is:  "+formatCurrency(updatedEntity.implied_value) })
                 } //if not a deal

               console.log("= OK checking upstream for "+updatedEntity.name+"\n")
               let investors = await iraSQL.getOwnershipForEntityUpstreamUpdate(updatedEntity.id)
               console.log("In calc/UpdateUpstream, got "+investors.length+ " investors: "+JSON.stringify(investors,null,4)+"\n");
               //outputLog.push({entry:"Updating Upstream Investors for : "+updatedEntity.name+"\n"})
               //outputLog.push({entry:"    Looking at "+investors.length+" investors for "+updatedEntity.name+"\n"})
               outputLog.push({entry:(indentChar.repeat(logIndent))+" Checking upstream investors for "+updatedEntity.name+ "..."})
               for (var i in investors) {
                      //outputLog.push({entry:investors[i].investor_name+" is an "+investors[i].investor_type_name+" ("+investors[i].investor_type_num+ ") with "+investors[i].capital_pct+"% \n"})
                      if(investors[i].investor_type_num === 4) { //entity Investor
                                logIndent+=2;
                                outputLog.push({entry:(indentChar.repeat(logIndent))+" "+investors[i].investor_name+" being updated because of its interest in "+investors[i].investment_name})
                                //outputLog.push({entry:"(1) Re-calulating Equity Value and (2) Updating Upstream Investors"})
                                //console.log(investors[i].investor_name + " is an Entity Investor, so calulating Implied Entity Vlaue ")

                                let results = await calcInvEntityImpliedValue(investors[i].investor_id);
                                let newImpliedValue = results[0];
                                console.log("DONE --> with new ImpliedValue (no contribs) for  "+investors[i].investor_name+ " is "+formatCurrency(newImpliedValue)+"\n");
                                //let oldEIEntity = await iraSQL.getEntityById(investors[i].id);
                                let updatedEIEntity = {
                                      implied_value: newImpliedValue,
                                      id: investors[i].investor_id
                                }
                                console.log( "\nin Upstream, HERE Updating entity Implied Value: "+JSON.stringify(updatedEIEntity));
                                //update the entity
                                var updateEntityResults = await iraSQL.updateEntityImpliedValue(updatedEIEntity);

                                //outputLog.push({entry:investors[i].investor_name + " new Entity Value is "+formatCurrency(newImpliedValue)+"\n"})
                                //outputLog.push({entry:"========================now going upstream to update investors====\n"})
                                logIndent+=2
                                let newoutputLog = await updateValueofInvestorsUpstream (investors[i].investor_id); //RECURSIVE CALL
                                outputLog.push(...newoutputLog);
                                logIndent-=4
                      }

                      console.log( "\n ======== in Upstream for "+updatedEntity.name+" done with "+investors[i].investor_name+"\n")

                      //outputLog.push.apply(outputLog, newoutputLog)
               } //for each investor
                  outputLog.push({entry:(indentChar.repeat(logIndent))+" === DONE UPDATE CYCLE for "+updatedEntity.name+" ==="})
                  outputLog.push({entry:(indentChar.repeat(logIndent))+"  "});

               //console.log("Output Log: "+outputLog.toString()+"\n")
               return outputLog


    } catch (err) {
              console.log("Err: Problem in updateUpstream : "+err);
              return "No ownership found."
    }


} //function update Upstream





//returns implied_value
async function calcInvEntityImpliedValue (entity_id) {
    try {
              //console.log("======Launching TUIP from calcInvEntityImpliedValue for "+entity_id);
              let totalPortfolioValue = 0.00
              let results = await totalupInvestorPortfolio(entity_id)
              // return [portfolioDeals, totalInvestmentValue, totalPortfolioValue, totalDistributions];
              let portfolioDeals = results[0]
              console.log("In Calc-ImpliedVal, found "+portfolioDeals.length+" investments for total PortValue of "+results[2])
              if (portfolioDeals.length >0 ) {  //there are investments for this ent.
                         totalPortfolioValue =  results[2]
                         return [totalPortfolioValue, portfolioDeals];
                } else { //if no deals
                        console.log("Its a Deal, so no investments for  "+ entity_id);
                        return [totalPortfolioValue, null];
               } //if ownership


    } catch (err) {
              console.log("Err: calcInvEntityImpliedValue : "+err);
              return [0.00, null]
    }
} //function






// these are Ownership Rows for an investor
async function totalupInvestorPortfolio (entity_id) {
    let foundInvestor = await iraSQL.getEntityById(entity_id);
    let investments = await iraSQL.getOwnershipForInvestor(entity_id);

      if (investments.length > 0) {
          console.log("In calc/TUIP, got "+investments.length+ " investments: "+JSON.stringify(investments,null,4)+"\n\n");
          let portfolioDeals = []  //empty array - add only if its a deal
          let totalPortfolioValue = 0;
          let totalInvestmentValue = 0;
          let totalDistributions = 0;

          for (let index = 0; index < investments.length; index++) {
               let expandDeal =  {}
               //if its a deal
               if (investments[index].deal_id) {
                             let dealFinancials = await iraSQL.getDealById(investments[index].deal_id);
                             expandDeal = calculateDeal(dealFinancials)
              //if its an entity
              } else {
                      let investmentEntity = await iraSQL.getEntityById(investments[index].investment_id)
                      console.log("Going from Own to Entity, the entity is: "+JSON.stringify(investmentEntity,null,4))
                      console.log("Because "+investments[index].investment_name+" is not a DEAL, went to Entity to get "+formatCurrency(investmentEntity.implied_value));
                      // if its an ENTITY - not a deal -- do it here
                      //if you want to get fancy, calculate implied_value on th fly here
                      //adding a stand-in expandDeal
                            expandDeal =  {
                                       "id": investments[index].id,
                                       "name": investments[index].investment_name,
                                       "aggregate_value": 0,
                                       "cash_assets": 0,
                                       "aggregate_debt": 0,
                                       "deal_debt": 0,
                                       "notes": "",
                                       "deal_equity_value": investmentEntity.implied_value, //yes!  get this from implied_value
                                       "total_assets": 0, //component of EV
                                       "total_debt": 0  //component of EV

                            };

              } //else for entity_id

              //this is common to both DEAL and ENTITY
              //console.log ("\n"+index+") Investment in ENTITY_ID :"+investments[index].investment_id+" "+investments[index].investment_name+" is not a DEAL \n")
              let transactionsForEntity = await iraSQL.getTransactionsForInvestorAndEntity(investments[index].investor_id, investments[index].investment_id,[1,3,5,6,7,8]);
              //console.log ("TUIP - got "+transactionsForEntity.length+" transactions for entity "+investments[index].investment_name+"  : "+JSON.stringify(transactionsForEntity, null, 4)+"\n")

               //now newPortfolioDeal
              let newPortfolioDeal = investments[index];
              newPortfolioDeal.expandDeal = expandDeal;
              console.log("\n\n*> Adding portfolio contribution from  "+newPortfolioDeal.expandDeal.name+" and using Equity Value of  "+formatCurrency(newPortfolioDeal.expandDeal.deal_equity_value));
              let result = await totalupCashInDeal(transactionsForEntity);

              newPortfolioDeal.transactionsForDeal = result[0];
              newPortfolioDeal.totalCashInDeal = result[1];
              newPortfolioDeal.dealDistributions = result[2];
              newPortfolioDeal.totalInvestments_noRollover = result[3];
              newPortfolioDeal.rolloverTransactions = result[4];
              newPortfolioDeal.investor_equity_value = newPortfolioDeal.expandDeal.deal_equity_value*(newPortfolioDeal.capital_pct/100);
              console.log("We have a newPortfolioDeal : "+JSON.stringify(newPortfolioDeal,null,4));
              console.log( "So with "+newPortfolioDeal.capital_pct/100+"% stake, "+newPortfolioDeal.investment_name+ " contributed "+formatCurrency(newPortfolioDeal.investor_equity_value)+" to  "+foundInvestor.name+"s  portfolio (TUIP)");
              //add the sums
              totalPortfolioValue += newPortfolioDeal.investor_equity_value  //save this as implied_value
              //this is already a total for that deal - how to exude 7's
              //need to change this.
              totalInvestmentValue += newPortfolioDeal.totalInvestments_noRollover;
              totalDistributions += newPortfolioDeal.dealDistributions;
              portfolioDeals.push(newPortfolioDeal);


            } //for

                    console.log("\nPortfolio for "+foundInvestor.name+" is ready - in TUI - implied Ent Value is "+formatCurrency(totalPortfolioValue));
              return [portfolioDeals, totalInvestmentValue, totalPortfolioValue, totalDistributions];

            }  else {  //if no investors
                    return [ [], null, null, null];
            }


      // } catch (err) {
      //               console.log("Err: No Ownership in TUIP problem: "+err);
      //               return [ [], null, null, null];
      // }

  } //function totalupInvestorPortfolio




//returns investment's value and %
//now just used in testing
async function getInvestorEquityValueInDeal(investor_id, entity_id) {
    let foundEntity = await iraSQL.getEntityById(entity_id);
    let deal_id = foundEntity.deal_id
    let dealFinancials = await iraSQL.getDealById(deal_id);
    let expandDeal = calculateDeal(dealFinancials)
    console.log ("In gIEVID - expandDeal "+JSON.stringify(expandDeal,null,4)+"\n");
    let own_results = await iraSQL.getOwnershipForInvestorAndEntity (entity_id, investor_id);
    console.log ("In gIEVID - own_results are: "+JSON.stringify(own_results,null,4)+"\n");
    return [expandDeal.deal_equity_value*(own_results[0].capital_pct/100), own_results[0].capital_pct];

}



//FOR OWNERSHIP - get own rows for entity, mith multiples for each wire
function totalupInvestors (investors) {
      console.log("\nTUI Found "+investors.length+" transaction rows")
      let expandInvestors = []
      let totalCapital = 0;
      let totalCapitalPct =0.0000;

      for (let index = 0; index < investors.length; index++) {
            let alreadyExists = false
            //console.log("\nTUI first looking at investor input: "+JSON.stringify(investors[index])+" \n")
            //check existing rows
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
                    expandInvestors.push(newOwnRow)
                    console.log("\nTUI - NEW own_row: "+(expandInvestors.length-1)+" from transaction: "+index+"  :" +JSON.stringify(newOwnRow)+"  \n");

            } //if not a dupe

      }//for index --- all own rows with transactions
      console.log("in TotalUpInvestors sending: " +totalCapitalPct+"%  ");
      const TUIresults = [expandInvestors, {
        totalCapital:totalCapital,
        totalCapitalPct:totalCapitalPct.toFixed(2)
      }];
      console.log("Results from TotalUpInvestors : " +JSON.stringify(TUIresults,null,4));
      return TUIresults;
  } //function



  async function totalupCashInDeal (transactions) {
        let standardTransactions = []
        let rolloverTransactions = []

        let totalCashInDeal = 0.0;
        let dealDistributions = 0.0
        let totalInvestments_noRollover = 0.0;

        for (let index = 0; index < transactions.length; index++) {
                //FORMATTED_AMOUNT OK FOR TRANSACTIONS DISPLAY - to acount for Own.adj
                if(transactions[index].tt_id != 7) { //standardTransactions
                          totalCashInDeal += transactions[index].t_amount
                          totalInvestments_noRollover += transactions[index].t_amount
                          //console.log("In tuCashinDeal adding "+transactions[index].t_amount+" to "+transactions[index].investor_name)

                          if(transactions[index].tt_id === 5 ) { //ownership adjustment - use %
                                  transactions[index].formatted_amount = transactions[index].t_own_adj+"%";
                          } else {
                                  transactions[index].formatted_amount = formatCurrency(transactions[index].t_amount)
                          }
                          standardTransactions.push(transactions[index])

                } else {  //rollover

                          transactions[index].formatted_amount = formatCurrency(transactions[index].t_amount)
                          //totalInvestments_noRollover += transactions[index].t_amount
                          //console.log("In tuCashinDeal adding "+transactions[index].t_amount+" to "+transactions[index].investor_name)
                          rolloverTransactions.push(transactions[index])
                }

                //if its a distribution
                if(transactions[index].tt_id === 3 ) {
                      dealDistributions += transactions[index].t_amount
                      totalInvestments_noRollover -= transactions[index].t_amount //ignore distribution - add it back in
                }

        } //for

        //console.log ("In TotalUPCash for "+transactions[0].investment_name+" is "+ totalCashInDeal+"and TotalDistributions is "+dealDistributions+"")
        return [standardTransactions, totalCashInDeal, dealDistributions, totalInvestments_noRollover, rolloverTransactions];

    } //function totalupCashInDeal







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
        console.log("In CalculateOwnership, the TotaCap is "+totalCapital+"")
        console.log("and TotalAdjPct is "+totalAdjOwnPct+"")

       //Math.round((totalAdjOwnPct*1000)/1000).toFixed(4)
       let availPct_after_OwnAdj = (100-totalAdjOwnPct)/100
       console.log("and availPct_after_OwnAdj is "+availPct_after_OwnAdj+"\n")
       //console.log("\nIn CalculateOwnership, Adust Onership % is "+totalAdjOwnPct+" and remaining % as decimal is "+availPct_after_OwnAdj+" \n")

        // now calculate % for each
        for (let index = 0; index < inv_trans_Rows.length; index++) {
                if(inv_trans_Rows[index].t_own_adj != 0) {  //if its an ownership adjustment (% only)
                      inv_trans_Rows[index].percent = (inv_trans_Rows[index].t_own_adj)/100
                      console.log("Its an OWN ADJUST trans - percent="+inv_trans_Rows[index].percent);
                } else {  //if its an acquisition
                      // if (inv_trans_Rows[index].tt_id === 6) {  //its an offset
                      //           inv_trans_Rows[index].percent = 0
                      // }  else {
                      inv_trans_Rows[index].percent = ((inv_trans_Rows[index].t_amount/totalCapital)*availPct_after_OwnAdj)

                      //} //if not a n offset
                } //if its ownership %

               totalOwnPct += inv_trans_Rows[index].percent*100
              // console.log("\nIn CalculateOwnership, after: "+inv_trans_Rows[index].id + "the % total is "+  totalOwnPct+"\n");
               //inv_trans_Rows[index].xxformattedPercent = (inv_trans_Rows[index].percent*100).toFixed(4)+"%"
               //inv_trans_Rows[index].xxformattedAmount = formatCurrency(inv_trans_Rows[index].t_amount)
               //console.log("IN validate ownership: "+ index +" lastname: "+expandInvestors[index].investor_name+" amount: "+expandInvestors[index].xxformattedAmount+" cap_pct: "+expandInvestors[index].capital_pct)
        }//for  total capital

        return [inv_trans_Rows, totalCapital, totalAdjOwnPct, totalOwnPct];
    } //function


  function calculateDeal (deal) {
        //console.log("\nin CalculateDeal, Deal is  "+JSON.stringify(deal));
         let expandDeal = deal
         expandDeal.deal_equity_value = expandDeal.aggregate_value+expandDeal.cash_assets-expandDeal.deal_debt-expandDeal.aggregate_debt
         expandDeal.total_assets = expandDeal.aggregate_value + expandDeal.cash_assets
         expandDeal.total_debt = expandDeal.aggregate_debt + expandDeal.deal_debt

        return expandDeal;
    } //function



    function formatCurrency (amount) {
                if (!amount) return "$0.00"

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
           //acquisition and acquistion offset match
            if ( (tt1 === tt2) ||  (tt1 === 1 && tt2 ===5) ||(tt1 === 5 && tt2 ===1) ){
                  return true;
            } else {
                  return false;
            }

    }

    async function createCSVforDownload(responseArray) {

            let columns = Object.keys(responseArray[0]);
            console.log(" Columns are: " + columns +"\n")
            let fields = [
                {
                  label:"Tr.ID",
                  value:columns[0]
                },
                {
                  label:"Investor Name",
                  value:columns[1]
                },
                {
                  label:"Invesment-Deal",
                  value:columns[2]
                },
                {
                  label:"Passthru Name",
                  value:columns[3]
                },
                {
                  label:"Transaction",
                  value:columns[4]
                },
                {
                  label:"Date",
                  value:columns[5]
                },
                {
                  label:"Amount",
                  value:columns[6]
                },
                {
                  label:"Adjust.to Ownership",
                  value:columns[7]
                },
                {
                  label:"Notes",
                  value:columns[8]
                }
            ]
            console.log(" Fields are: " + fields +"\n")
            let options = { fields };
          //console.log("in create CSV - Trans JSON data has  " + JSON.stringify(responseArray,null,4) +"\n")
            const csv = j2csvParser(responseArray, options);
            console.log("\nTHE CSV is "+csv);
            return csv;

    }



    function isIterable(obj) {
      // checks for null and undefined
      if (obj == null) {
        return false;
      }
      return typeof obj[Symbol.iterator] === 'function';
    }



    hbs.registerHelper('formatUSD', function(amount, options) {
                if (!amount) return "$0.00";
                if (typeof(amount) === 'string') return amount;
                if (amount >= 0) {
                   return "$"+amount.toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
                } else {
                   return "($"+(-1*amount).toFixed(0).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")+")";
                }
    }); //function




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
