const { assertRevert } = require("./helper/assertRevert");
const CrowdSale = artifacts.require("CrowdSale");

let crowdSale;
let owner;
let someone;
let buyer1; 

before(async () => {
    // open and end time is not real case here, so we are not testing onlyWhileOpen here
    var openingTime = Date.now();
    var closingTime = openingTime + 5*60; // 5 mins after opening time 
    var pioneerTimeEnd = closingTime;
    crowdSale = await CrowdSale.new(openingTime, closingTime, pioneerTimeEnd); 
});


contract('CrowdSale', function (accounts) {

    // define roles by accounts 
    owner = accounts[0];
    someone = accounts[1];
    buyer1 = accounts[2];

    it("test ownership transfer", async function () {
        var _owner = await crowdSale.owner();
        assert.equal(_owner, owner, "owner should be equaled to contract deployer");

        // transfer ownership to someone 
        await crowdSale.transferOwnership(someone);
        await crowdSale.claimOwnership({from: someone});
        var _owner = await crowdSale.owner();
        assert.equal(_owner, someone, "owner should be changed to new owner");

        // transfer back ownership to original owner
        await crowdSale.transferOwnership(owner, {from: someone});
        var result = await crowdSale.claimOwnership({from: owner});
        var _owner = await crowdSale.owner();
        assert.equal(_owner, owner, "owner should be changed back to original contract deployer");

        // check ownership tranfer event
        assert.equal(result.logs[0].event, "OwnershipTransferred");
        assert.equal(result.logs[0].args.previousOwner.valueOf(), someone);
        assert.equal(result.logs[0].args.newOwner.valueOf(), owner);
    });

    it("test setters", async function () {
        // test setRate
        var rate = 10;
        var result = await crowdSale.setRate(rate);

        // check event emit
        assert.equal(result.logs[0].event, "RateChanged");
        assert.equal(result.logs[0].args.rate.valueOf(), rate);

        // check someone other than owner 
        await assertRevert(crowdSale.setRate(rate, {from: someone}), "rate should only be set by owner"); 

        //TODO: add other setter tests
    });

    it("test withdraw", async function () {
        // withdraw the total amount of contract balance 
        var contractBalance = web3.eth.getBalance(crowdSale.address);
        var result = await crowdSale.withdraw(contractBalance);

        // check event emit
        assert.equal(result.logs[0].event, "Withdraw");
        assert.equal(result.logs[0].args.amount.valueOf(), contractBalance);

        // withdraw money that exceeds total contract balance 
        await assertRevert(crowdSale.withdraw(contractBalance + 10), "cannot withdraw money that exceeds total contract balance"); 

        // check someone other than owner 
        await assertRevert(crowdSale.withdraw(contractBalance, {from: someone}), "only owner should be able to withdraw"); 
    });

    it("test pause", async function (){
        var paused = await crowdSale.paused();
        assert.equal(paused, false, "pause should be set to false initially");

        // owner pause the crowdsale
        var result = await crowdSale.pause();
        assert.equal(result.logs[0].event, "Pause");
        paused = await crowdSale.paused();
        assert.equal(paused, true, "pause should be set to true when paused");

        // owner unpause
        result = await crowdSale.unpause();
        assert.equal(result.logs[0].event, "Unpause");
        paused = await crowdSale.paused();
        assert.equal(paused, false, "pause should be set to false when unpaused");
    });
});
  