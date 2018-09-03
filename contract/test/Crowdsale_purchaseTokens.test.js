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
const openingTime = Math.round(Date.now()/1000);
const closingTime = openingTime + timestep * 2;
const pioneerTimeEnd = openingTime + timestep;

let crowdsale;

let weis = new BigNumber(0);
let tokens = new BigNumber(0);
let totalWeis = new BigNumber(0);
let totalTokens = new BigNumber(0);


contract('Crowdsale', function (accounts) {
    const [owner, buyer1, buyer2, buyer3, anyone] = accounts;

    context('test small buy', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        it("should fail when paying 0 ether", async function () {
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: 0})
            );
        });

        it("should fail when buying less than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).minus(1);
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: weis})
            );
        });

        it("should buy more than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).plus(1);
            totalWeis = totalWeis.plus(weis);
            totalTokens = totalWeis.times(rate);
            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: weis}).should.be.fulfilled;
        });

        it("should update totalWeiRaised", async function () {
            let _totalWeiRaised = await crowdsale.totalWeiRaised();
            _totalWeiRaised.should.be.bignumber.equal( totalWeis );
        });

        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( totalWeis );
        });

        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        it("should update balanceOf", async function () {
            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });



        it("should buy less than 200 tokens after buying more than 200 tokens", async function () {
            crowdsale.purchaseTokens(anyone, {from: buyer1, value: 1}).should.be.fulfilled;
            totalWeis = totalWeis.plus(1);
            totalTokens = totalWeis.times(rate);

        });

        it("should update totalWeiRaised", async function () {
            (await crowdsale.totalWeiRaised())
            .should.be.bignumber.equal( totalWeis );
        });

        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( totalWeis );
        });

        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        it("should update balanceOf", async function () {
            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });



        it("should still fail when paying 0 ether", async function () {
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: 0})
            );
        });



        it("should fail when buyer2 buying less than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).minus(1);
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer2, value: weis})
            );
        });

        it("should buyer2 buy more than 200 tokens", async function () {
            weis = ether(1);
            await crowdsale.purchaseTokens(anyone, {from: buyer2, value: weis}).should.be.fulfilled;
            tokens = weis.times(rate);
            totalWeis = totalWeis.plus(weis);
            totalTokens = totalWeis.times(rate);
        });

        it("should update totalWeiRaised", async function () {
            (await crowdsale.totalWeiRaised())
            .should.be.bignumber.equal( totalWeis );
        });

        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer2))
            .should.be.bignumber.equal( weis );
        });

        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer2))
            .should.be.bignumber.equal( tokens );
        });

        it("should update balanceOf", async function () {
            tokens = weis.times(rate);
            (await crowdsale.balanceOf(buyer2))
            .should.be.bignumber.equal( tokens );
        });

        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });
    });


    context('test hard cap', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        it("should only allow owner to set hardCap", async function () {
            let newHardCap = ether(51);
            await expectThrow(
                crowdsale.setHardCap(newHardCap, {from: anyone})
            );

            let _hardCap = await crowdsale.hardCap();
            _hardCap.should.be.bignumber.equal( hardCap );
        });

        it("should owner be able to set new hardCap", async function () {
            let _hardCap = await crowdsale.hardCap();
            _hardCap.should.be.bignumber.equal( hardCap );

            let newHardCap = ether(50);
            await crowdsale.setHardCap(newHardCap, {from: owner});

            let _newHardCap = await crowdsale.hardCap();
            _newHardCap.should.be.bignumber.equal( newHardCap );
        });

        it("should be able to buy tokens when paying more than hardCap", async function () {
            let _hardCap = await crowdsale.hardCap();

            let _weis = _hardCap.plus(ether(10));

            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: _weis}).should.be.fulfilled;

            // should only buy up to hardCap when paying more than that
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( _hardCap );

            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( _hardCap.times(rate) );

            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( _hardCap.times(rate) );
        });
    });
});
