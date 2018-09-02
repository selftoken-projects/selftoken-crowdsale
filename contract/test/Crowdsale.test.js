const CrowdSale = artifacts.require("CrowdSale");

let crowdSale;

before(async () => {
    // open and end time is not real case here 
    var openingTime = Date.now();
    var closingTime = openingTime + 5*60; // 5 mins after opening time 
    var pioneerTimeEnd = closingTime;
    crowdSale = await CrowdSale.new(openingTime, closingTime, pioneerTimeEnd);
});


contract('CrowdSale', function (accounts) {
    it("first test", function () {
        
    });
});
  