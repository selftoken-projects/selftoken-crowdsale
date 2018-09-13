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

        /* [Begin State]
         * crowdsale deployed
        */
        it("should fail when paying 0 ether", async function () {
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: 0})
            );
        });

        /* [Begin State]
         * crowdsale deployed
        */
        it("should fail when paying -1 ether", async function () {
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: -1})
            );
        });

        /* [Begin State]
         * crowdsale deployed
        */
        it("should fail when buying less than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).minus(1);
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: weis})
            );
        });

        /* [Begin State]
         * crowdsale deployed
        */
        it("should buy more than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).plus(1);
            totalWeis = totalWeis.plus(weis);
            totalTokens = totalWeis.times(rate);
            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: weis}).should.be.fulfilled;
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update totalWeiRaised", async function () {
            let _totalWeiRaised = await crowdsale.totalWeiRaised();
            _totalWeiRaised.should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update balanceOf", async function () {
            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should be 200 token", async function () {
            (totalTokens.toNumber())
            .should.be.bignumber.equal(200000000000000000000);
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should buy less than 200 tokens after buying more than 200 tokens", async function () {
            crowdsale.purchaseTokens(anyone, {from: buyer1, value: 1}).should.be.fulfilled;
            totalWeis = totalWeis.plus(1);
            totalTokens = totalWeis.times(rate);
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should fail when paying 0 ether after successfully purchased", async function () {
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer1, value: 0})
            );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        // it("should fail when paying -1 ether after successfully purchased", async function () {
        //     await expectThrow(
        //         crowdsale.purchaseTokens(anyone, {from: buyer1, value: -1})
        //     );
        // });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update totalWeiRaised", async function () {
            (await crowdsale.totalWeiRaised())
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update balanceOf", async function () {
            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should be 200 token still", async function () {
            (totalTokens.toNumber())
            .should.be.bignumber.equal(200000000000000000000);
        });


        /* [Begin State]
         * crowdsale deployed
         * token purchased: 200 token
         * - buyer1: 200 token
        */
        it("should buy 1 tokens after buying more than 200 tokens", async function () {
            let tokenToPurchased = ether(1);
            weis = tokenToPurchased.dividedToIntegerBy(rate).plus(1);
            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: weis}).should.be.fulfilled;

            totalWeis = totalWeis.plus(weis);
            totalTokens = totalWeis.times(rate);
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: 201 token
         * - buyer1: 201 token
        */
       it("should update totalWeiRaised", async function () {
            (await crowdsale.totalWeiRaised())
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should update balanceOf", async function () {
            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should be 201 token right now", async function () {
            (totalTokens.toNumber())
            .should.be.bignumber.equal(201000000000000000000);
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        */
        it("should fail when buyer2 buying less than 200 tokens", async function () {
            weis = minTokensPurchased.dividedToIntegerBy(rate).minus(1);
            await expectThrow(
                crowdsale.purchaseTokens(anyone, {from: buyer2, value: weis})
            );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should buyer2 buy more than 200 tokens", async function () {
            weis = ether(1);
            await crowdsale.purchaseTokens(anyone, {from: buyer2, value: weis}).should.be.fulfilled;
            tokens = weis.times(rate);
            totalWeis = totalWeis.plus(weis);
            totalTokens = totalWeis.times(rate);

            (tokens.toNumber())
            .should.be.bignumber.equal(ether(rate));
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update totalWeiRaised", async function () {
            (await crowdsale.totalWeiRaised())
            .should.be.bignumber.equal( totalWeis );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update weiRaisedFrom", async function () {
            (await crowdsale.weiRaisedFrom(buyer2))
            .should.be.bignumber.equal( weis );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update tokensPurchased", async function () {
            (await crowdsale.tokensPurchased(buyer2))
            .should.be.bignumber.equal( tokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update balanceOf", async function () {
            tokens = weis.times(rate);
            (await crowdsale.balanceOf(buyer2))
            .should.be.bignumber.equal( tokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });

        /* [Begin State]
        * crowdsale deployed
        * token purchased: 201 token
        * - buyer1: 201 token
        * - buyer2: 3600 token
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });
    });


    context('test hard cap', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        /* [Begin State]
        * crowdsale deployed
        */
        it("should only allow owner to set hardCap", async function () {
            let newHardCap = ether(51);
            await expectThrow(
                crowdsale.setHardCap(newHardCap, {from: anyone})
            );

            let _hardCap = await crowdsale.hardCap();
            _hardCap.should.be.bignumber.equal( hardCap );
        });

        /* [Begin State]
        * crowdsale deployed
        */
        it("should owner be able to set new hardCap", async function () {
            let _hardCap = await crowdsale.hardCap();
            _hardCap.should.be.bignumber.equal( hardCap );

            let newHardCap = ether(50);
            await crowdsale.setHardCap(newHardCap, {from: owner});

            let _newHardCap = await crowdsale.hardCap();
            _newHardCap.should.be.bignumber.equal( newHardCap );
        });

        /* [Begin State]
        * crowdsale deployed
        */
        it("should be able to buy tokens and be refunded the extra amount when paying more than hardCap", async function () {
            let _hardCap = await crowdsale.hardCap();
            let _totalWeiRaised = await crowdsale.totalWeiRaised();
            let _weis = _hardCap.plus(ether(10));

            let originalBalance = web3.eth.getBalance(buyer1);
            let receipt = await crowdsale.purchaseTokens(anyone, {from: buyer1, value: _weis}).should.be.fulfilled;
            let postPurchaseBalance = web3.eth.getBalance(buyer1);

            let gasUsed = receipt.receipt.gasUsed;

            originalBalance.minus(_hardCap).add(_totalWeiRaised).minus(gasUsed*10e10)
            .should.be.bignumber.equal(postPurchaseBalance);
        });

        it("check buyer1 weiRaisedFrom update", async function () {
            let _hardCap = await crowdsale.hardCap();
            (await crowdsale.weiRaisedFrom(buyer1))
            .should.be.bignumber.equal( _hardCap );
        });

        it("check buyer1 tokensPurchased update", async function () {
            let _hardCap = await crowdsale.hardCap();
            (await crowdsale.tokensPurchased(buyer1))
            .should.be.bignumber.equal( _hardCap.times(rate) );
        });

        it("check totalSupply update", async function () {
            let _hardCap = await crowdsale.hardCap();
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( _hardCap.times(rate) );
        });
    });
});
