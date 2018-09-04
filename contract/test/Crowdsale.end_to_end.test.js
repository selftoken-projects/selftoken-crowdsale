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
        // buyer2 is not a pioneer
        await crowdsale.purchaseTokens(buyer2, {from: buyer1, value: amountToBuyWei});

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        totalTokens = totalTokens.plus(tokens);

        // buyer1 becomes pioneer and a qualified referrer (referSender)
        assert.equal(await crowdsale.isPioneer(buyer1), true);
        // examine buyer2 pioneership
        assert.equal(await crowdsale.isPioneer(buyer2), false);

        // record buyer1, buyer2 original balance 
        let buyer1BalanceOriginal = await crowdsale.balanceOf(buyer1);
        let buyer2BalanceOriginal = await crowdsale.balanceOf(buyer2);

        // buyer1 (pioneer) refers buyer2 to buy
        amountToBuyWei = ether(0.1); // some random amount 
        let result = await crowdsale.purchaseTokens(buyer1, {from: buyer2, value: amountToBuyWei});

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        // have to include refer bonus here since buyer1 is now a qualified referrer
        _referSenderBonus = tokens.times(referSenderBonusPercentage).dividedToIntegerBy(100);
        _referReceiverBonus = tokens.times(referReceiverBonusPercentage).dividedToIntegerBy(100);
        totalTokens = totalTokens.plus(tokens).plus(_referSenderBonus).plus(_referReceiverBonus);

        // buyer1 gained bonus by referring others
        (await crowdsale.balanceOf(buyer1)).should.be.bignumber.equal( buyer1BalanceOriginal.plus(_referSenderBonus) );

        // buyer2 gained bonus by being referred
        (await crowdsale.balanceOf(buyer2)).should.be.bignumber.equal( buyer2BalanceOriginal.plus(tokens).plus(_referReceiverBonus) );

        // check totalTokens
        (await crowdsale.totalSupply()).should.be.bignumber.equal( totalTokens );

        // Sum everything up. All balances should be the total supply
        (buyer1BalanceOriginal.plus(_referSenderBonus)
        .plus(buyer2BalanceOriginal.plus(tokens).plus(_referReceiverBonus))
        .should.be.bignumber.equal( totalTokens));
    });

    it("buyer3 does not hold any token but tries to refer buyer2", async function () {

        // buyer3 is not a qualified referrer because he does not hold any token (referSender)
        assert.equal(await crowdsale.tokensPurchased(buyer3), 0);

        // record buyer2, buyer3 original balance 
        let buyer2BalanceOriginal = await crowdsale.balanceOf(buyer2);
        let buyer3BalanceOriginal = await crowdsale.balanceOf(buyer3);

        // buyer3 let buyer2 fill in his referral address (buyer1 tries to refer buyer2)
        amountToBuyWei = ether(0.1); // some random amount 
        await crowdsale.purchaseTokens(buyer3, {from: buyer2, value: amountToBuyWei});

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        // cannot include refer bonus here since buyer3 is not a qualified referrer
        totalTokens = totalTokens.plus(tokens);

        // buyer3 does not gain bonus (his balance remains the same)
        (await crowdsale.balanceOf(buyer3)).should.be.bignumber.equal( buyer3BalanceOriginal);

        // buyer2 does not gain bonus because of the refer (his balance = original + the amount of tokens he purchased)
        (await crowdsale.balanceOf(buyer2)).should.be.bignumber.equal( buyer2BalanceOriginal.plus(tokens) );

        // check totalTokens
        (await crowdsale.totalSupply()).should.be.bignumber.equal( totalTokens );
    });

    it("Enter crowdsale next stage", async function () {

        // Initial Stage
        (await crowdsale.currentStage()).should.be.bignumber.equal( 0 );

        // calculate remaining balance to reach next stage
        let _totalWeiRaised = await crowdsale.totalWeiRaised();
        let remainWeiToNextStage = weiRaisedPerStage.minus(_totalWeiRaised);

        // buyer1 purchase that amount
        let amountToBuyWei = remainWeiToNextStage;
        // no referrer this time 
        await crowdsale.purchaseTokens(0, {from: buyer1, value: amountToBuyWei});

        // Enter next stage
        (await crowdsale.currentStage()).should.be.bignumber.equal( 1 );

        // update totalTokens
        tokens = amountToBuyWei.times(rate);
        // calculate pioneer bonus by stage 
        totalTokens = totalTokens.plus(tokens).plus(pioneerBonusPerStage.times(1));

        // check totalTokens
        (await crowdsale.totalSupply()).should.be.bignumber.equal( totalTokens );
    });

    it("owner pause the crowdsale", async function(){

        // owner pause
        await crowdsale.pause();

        // buyer1 wants to buy when paused -> failed
        await assertRevert(crowdsale.purchaseTokens(0, {from: buyer1, value: 10}));

        // owner unpause
        await crowdsale.unpause();

        // buyer1 buys successfully 
        await crowdsale.purchaseTokens(0, {from: buyer1, value: 10});
    });

    it("Reach hardcap", async function () {

        // calculate remaining balance to reach hard cap
        let _totalWeiRaised = await crowdsale.totalWeiRaised();
        let remainWeiToHardcap = hardCap - _totalWeiRaised;

        // buyer1 purchase that amount
        let amountToBuyWei = remainWeiToHardcap;
        // no referrer this time 
        await crowdsale.purchaseTokens(0, {from: buyer1, value: amountToBuyWei});

        // Enter stage 10, hard cap reached
        (await crowdsale.currentStage()).should.be.bignumber.equal( 10 );

        // buyer2 cannot purchase any token after hardcap is reached
        await assertRevert(crowdsale.purchaseTokens(0, {from: buyer2, value: 10})); 

        // owner withdraw all balances
        let result = await crowdsale.withdrawAll();

        // check event 
        assert.equal(result.logs[0].event, "Withdraw");
        assert.equal(result.logs[0].args.amount.valueOf(), hardCap);
    });
});

