const { assertRevert } = require("./helper/assertRevert");
const { ether } = require("./helper/ether");
const { expectThrow } = require("./helper/expectThrow");
const { latestTime } = require("./helper/latestTime");
const { increaseTime, increaseTimeTo } = require("./helper/increaseTime");
const CrowdSale = artifacts.require("Crowdsale");

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

let crowdSale;

before(async () => {
    // open and end time is not real case here, so we are not testing onlyWhileOpen here
    const timestep = 86400;
    const openingTime = Math.round(Date.now()/1000) -1000;
    const closingTime = openingTime + timestep * 2;
    const pioneerTimeEnd = openingTime + timestep;
    crowdSale = await CrowdSale.new(openingTime, closingTime, pioneerTimeEnd); 
});


contract('CrowdSale', function (accounts) {

    const [owner, buyer1, buyer2, buyer3, anyone] = accounts;

    it("test ownership transfer", async function () {
        var _owner = await crowdSale.owner();
        assert.equal(_owner, owner, "owner should be equaled to contract deployer");

        // transfer ownership to anyone 
        await crowdSale.transferOwnership(anyone);
        await crowdSale.claimOwnership({from: anyone});
        var _owner = await crowdSale.owner();
        assert.equal(_owner, anyone, "owner should be changed to new owner");

        // transfer back ownership to original owner
        await crowdSale.transferOwnership(owner, {from: anyone});
        var result = await crowdSale.claimOwnership({from: owner});
        var _owner = await crowdSale.owner();
        assert.equal(_owner, owner, "owner should be changed back to original contract deployer");

        // check ownership tranfer event
        assert.equal(result.logs[0].event, "OwnershipTransferred");
        assert.equal(result.logs[0].args.previousOwner.valueOf(), anyone);
        assert.equal(result.logs[0].args.newOwner.valueOf(), owner);
    });

    it("test setters", async function () {
        // test setRate
        var rate = 10;
        var result = await crowdSale.setRate(rate);

        // check event emit
        assert.equal(result.logs[0].event, "RateChanged");
        assert.equal(result.logs[0].args.rate.valueOf(), rate);

        // check anyone other than owner 
        await assertRevert(crowdSale.setRate(rate, {from: anyone}), "rate should only be set by owner"); 

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

        // check anyone other than owner 
        await assertRevert(crowdSale.withdraw(contractBalance, {from: anyone}), "only owner should be able to withdraw"); 
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

    it("test direct send money to contract", async function() {
        await web3.eth.sendTransaction({to:crowdSale.address, from:buyer2, value: ether(0.5)});

        let amountToBuyWei = ether(0.5);
        let tokens = amountToBuyWei.times(rate);

        (await crowdsale.balanceOf(buyer2)).should.be.bignumber.equal( tokens);
    })
});
  