const { assertRevert } = require("./helper/assertRevert");
const { ether } = require("./helper/ether");
const { expectThrow } = require("./helper/expectThrow");
const { latestTime } = require("./helper/latestTime");
const { increaseTime, increaseTimeTo } = require("./helper/increaseTime");
const Crowdsale = artifacts.require("Crowdsale");


const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const rate = new BigNumber(3600);
const minTokensPurchased = ether(200);
const referSenderBonusPercentage = new BigNumber(5);
const referReceiverBonusPercentage = new BigNumber(5);
const pioneerBonusPerStage = ether(45000);
const pioneerWeiThreshold = ether(1);
const maxStages = new BigNumber(10);
const weiRaisedPerStage = ether(1000);
const hardCap = ether(10000);

const timestep = 86400;
const openingTime = Math.round(Date.now()/1000) -1000;
const closingTime = openingTime + timestep * 2;
const pioneerTimeEnd = openingTime + timestep;

let crowdsale;

let weis = new BigNumber(0);
let tokens = new BigNumber(0);
let totalWeis = new BigNumber(0);
let totalTokens = new BigNumber(0);

contract('Crowdsale', function (accounts) {
    const [owner, buyer1, buyer2, buyer3, anyone] = accounts;

    it("should deploy new contract", async function () {
        crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
    });

    it("buyer1 becomes a pioneer and refers buyer2", async function () {

        // buyer1 purchase token 
        let amountToBuyWei = pioneerWeiThreshold;
        await crowdsale.purchaseTokens(buyer2, {from: buyer1, value: amountToBuyWei});

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        totalTokens = totalTokens.plus(tokens);

        // buyer1 becomes pioneer and a qualified referrer (referSender)
        assert.equal(await crowdsale.isPioneer(buyer1), true);

        // record buyer1 original balance 
        let buyer1BalanceOriginal = await crowdsale.balanceOf(buyer1);

        // buyer1 refers buyer2 to buy
        amountToBuyWei = ether(0.1); // some random amount 
        await crowdsale.purchaseTokens(buyer1, {from: buyer2, value: amountToBuyWei});

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        // have to include reder bonus here since buyer1 is now a qualified referrer
        _referSenderBonus = tokens.times(referSenderBonusPercentage).dividedToIntegerBy(100);
        _referReceiverBonus = tokens.times(referReceiverBonusPercentage).dividedToIntegerBy(100);
        totalTokens = totalTokens.plus(tokens).plus(_referSenderBonus).plus(_referReceiverBonus);

        // buyer1 gained bonus by referring others
        (await crowdsale.balanceOf(buyer1)).should.be.bignumber.equal( buyer1BalanceOriginal.plus(_referSenderBonus) );

        // buyer2 gained bonus by being referred
        (await crowdsale.balanceOf(buyer2)).should.be.bignumber.equal( tokens.plus(_referReceiverBonus) );

        // check totalTokens
        (await crowdsale.totalSupply()).should.be.bignumber.equal( totalTokens );
    });

});

