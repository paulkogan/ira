# IRA - Investor Reporting Application
IRA is a system for tracking and repprting investor participation in Real Estate deals

BUSINESS PURPOSE
IRA is a web-based application for tracking and reporting on Investor ownership in real-estate deals.

Financial analysts for GP Properties, a real estate developer and investment trust, update transactions leading up to a deal capitalization. At the key closing date, the investor ownership information is "set" and all investors are assigned an ownership % in the deal. 

Subsequently, investors need to understand the value of their investment portfolio with GPP by accessing reports, primarily the Investor Portfolio report. The portfolio pulls together the investor's information across multiple deals, accounting for updates in property valuation and subsequent financings such as roll-overs and capital-calls. 

Investors can be individual investors or investment entities, such as LLCs, trusts, holding companies etc. Investments can be "nested",  with entities holding "ownership interests"  in other entities. These ownership interests need to be calculated up the chain when the value or ownership of a given deal or investment entity changes.


THE STACK
* Node version 8.4 with Express
* Express Passport for Auth
* We use ES6 async/await functions and promises instead of passing back CBs functions. 
* We use Mocha for testing.
* Hosted on AWS Elastic Beanstalk. 
* MySQL DB on AWS RDS


TABLES
* Transactions - records of investments, adjustments to ownership. 
I.E. John Smith invested + wired $800,000 for Deal A.

* Entities - the all-purpose entity, covering all participants in investments. Types of Entity are:
- Deal - has upstream investors
- Investor (person) - has downstream investments
- Investment Entity  - has both upstream investors and downstream investments
- Pass-thru Entity

 * Ownership - a record of % ownership in a Deal or Entity. Such as: 
ownership = {
investor_id : 5, 
investment_entity_id : 17, 
pct_own : 5.7%
}

Multiple transactions (such as multiple wires of $$) need to be combined into a single Ownership record

* Deals - holds details of a Deal, with Property Valuation information, critically, the equity value of a deal. Each deal has a 1-1 corresponding Entity record.

When calculating an investor's Investment_Value in a deal, it's deal_equity_value (which can change as the property is re-evaluated) * investor_Own_pct (which stays fixed after the deal is "set")


CODE FILES
* ira.js  
	* runs the main Node Express server on 8081
	* serves the key routes for adding & updating such as 
			/add-transaction'
/setownership/:id'

	* also has the Auth/login functions for Passport
	* also has the api files (which I need to move out)

* ira-model.js (exported as iraSQL)
	* holds the 31 SQL functions, including: 
			  getOwnershipForEntity,
  getOwnershipForInvestorAndEntity,
  getTransactionsForInvestorAndEntity,
  getTransactionsByType,
  updateEntityImpliedValue,
  updateDeal,
  clearOwnershipForEntity,
  deleteTransaction
  authUser


* ira-calc.js
	holds the 12 calculating worker functions, including:
  totalupInvestorPortfolio,
  totalupCashInDeal,
  calculateOwnership,
  calculateDeal,
  calcInvEntityImpliedValue,
  updateValueofInvestorsUpstream,
  getInvestorEquityValueInDeal,
  createCSVforDownload
	
also has HBS helper formatting functions

*ira-menus.js 
	the second routes file, hold routes involved in display such as:
			/transactions/:id
/ownership/:id
/portfolio/:id
/entities
/home


*Views
the Express routes perform calculations and then hand off to one of 22 Handlebar view files to render HTML in the client, including:

add-deal.hbs
add-entity.hbs
entity-details.hbs
home.hbs
investors.hbs
set-ownership.hbs
show-results.hbs
update-deal.hbs
update-entity.hbs

* ira.test
	Mocha tests file


AREAS OF FOCUS
 Key features and challenges

(1) Calculating ownership 
using routes:
/setownership/:id', 
/process_set_ownership
/portfolio/:id', 
and functions:
iraSQL.getTransactionsForInvestment
calc.totalupInvestors
calc.calculateOwnership
	
Calculating ownership % is one of key things that IRA does. This involves:  
(a) Combining transaction rows into ownership rows  based on investor. So in case of a $10M capital raise, if investor A wired $300K in one wire and $700K in another wire, these need to be combined into a single 10.00% ownership stake.
The way we do this is by first going through all the acquisition transactions, coming up with a totalCapital number and then assigning: 
ownership = totalInvestorAmount/  totalCapital

As transactions are combined into ownership, we track this relationship by writing records into the own_trans_lookup table.

(b) Ownership adjustment - in some cases an investor can have a flat 20% of a deal, so any further capital-in needs to split the remaining 80% of the deal. So in the previous case, Investor A would have 8.00% ownership of the deal in a $10M capital raise. OwnAdjust transactions can be negative or positive.

(c) Displaying the portfolio - The challenge here is to get transaction information back into ownership, to display wire information in the portfolio report.  We do this with the own_trans_lookup table, pulling out which transactions went into which ownership rows.

We also need to account for Distributions, where an Investor gets cash back from a deal as a kind of dividend, without reducing their own_%

		
(2) Global Entity Value calculation across nested Investment Entities
using routes:
/process_update_deal'
/process_set_ownership

and functions
  calc.calcInvEntityImpliedValue
  calc.updateValueofInvestorsUpstream,
  calc.getInvestorEquityValueInDeal,


Business Reason 
An investment entity acts as both an investor, in having a portfolio with an equity value, and as a  deal, in having value for its upstream investors. 

While the value of a deal is set declaratively, the value of an investment entity Q is determined by its downstream investments.  So if any of these downstream investments change value,  the value of the entity Q must be re-computed.

 In addition, any upstream investment entities need to be updated because of the changed 
 value of entity Q.

Test Example
DDD  owns 25% of Deal FFF
AAA owns 25% of DDD
Horizon CCC owns 25% of DDD
AAA owns 10% of Horizon CCC
EEE owns 25% of Deal FFF
                             
So a $48M change in the value of  Deal FFF should show:
1)  $12M increase in value in DDD    
2)  $3M increase in value of Horizon CCC
3) $3,300,000 increase in value of AAA
4) $12M increase in value of EEE   

Methodology
If Entity is a Deal, the implied_value = deal.equity value
if Entity is an InvEnt, implied_value is total of its investments (calcEntityImpliedValue)

Use recursive functions to traverse the chain of nested entity investors. 


Walkthru 
At set ownership of Entity F or update value of Deal F
  updateValueofInvestorsUpstream(F) 
look at all the investors into entity F
getOwnership with Investor_type, and no DATE JOIN
if one of the investors in an investor entity (i.e. C), do:
      			 (1) calcInvEntityImpliedValue (C) {
	look at all downstream investments for C ( D, E, F)      
determine value of Entity's stake in each one (% * Value)
total them up and assign as new value to C.implied_value
(use totalupInvestorPortfolio and save totalPortfolioValue)                

              (2) updateValueofInvestorsUpstream (C) <RECURSIVE>
look at all the investors into entity C (A, B)
if one of the investors in an investor entity (i.e A)
 	calcInvEntityImpliedValue(A) 
 	updateValueofInvestorsUpstream(A) <RECURSIVE>
                          				
return log.



