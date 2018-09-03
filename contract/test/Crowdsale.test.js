const CrowdSale = artifacts.require("CrowdSale");

let crowdSale;
let owner;
let buyer1; 

before(async () => {
    // open and end time is not real case here 
    var openingTime = Date.now();
    var closingTime = openingTime + 5*60; // 5 mins after opening time 
    var pioneerTimeEnd = closingTime;
    crowdSale = await CrowdSale.new(openingTime, closingTime, pioneerTimeEnd); 
});


contract('CrowdSale', function (accounts) {

    // define roles by accounts 
    owner = accounts[0];
    buyer1 = accounts[1];

    it("test ownership transfer", async function () {
        var _owner = await crowdSale.owner();
        assert.equal(_owner, owner, "owner should be equaled to contract deployer");

        var newOwner = accounts[1];
        await crowdSale.transferOwnership(newOwner);
        await crowdSale.claimOwnership({from: newOwner});
        var _owner = await crowdSale.owner();
        assert.equal(_owner, newOwner, "owner should be changed to new owner");
    });
});
  