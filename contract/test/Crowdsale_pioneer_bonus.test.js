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

    context('test referral bonus', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        /* [Begin State]
         * crowdsale deployed
        */
        it("should be a pioneer after paying >= pioneerWeiThreshold", async function () {
            totalTokens = pioneerWeiThreshold.times(rate);

            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: pioneerWeiThreshold});
            assert.equal(await crowdsale.isPioneer(buyer1), true);
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: pioneerWeiThreshold * rate
         * - buyer1 (pioneer): pioneerWeiThreshold * rate
        */
        it("should not be able to refer self", async function () {
            weis = pioneerWeiThreshold;
            tokens = weis.times(rate);
            totalTokens = totalTokens.plus(tokens);

            await crowdsale.purchaseTokens(buyer1, {from: buyer1, value: pioneerWeiThreshold});

            (await crowdsale.tokensReferSenderBonus(buyer1))
            .should.be.bignumber.equal( 0 );

            let _totalSupply = await crowdsale.totalSupply();
            _totalSupply.should.be.bignumber.equal( pioneerWeiThreshold.times(rate).times(2) );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: pioneerWeiThreshold * rate * 2
         * - buyer1 (pioneer): pioneerWeiThreshold * rate * 2
        */
        it("should buyer2 get referral bonus", async function () {
            weis = ether(0.1);
            tokens = weis.times(rate);
            let _referSenderBonus = tokens.times(referSenderBonusPercentage).dividedToIntegerBy(100);
            let _referReceiverBonus = tokens.times(referReceiverBonusPercentage).dividedToIntegerBy(100);
            totalTokens = totalTokens.plus(tokens).plus(_referSenderBonus).plus(_referReceiverBonus);
            let _buyer1Balance = await crowdsale.balanceOf(buyer1);

            await crowdsale.purchaseTokens(buyer1, {from: buyer2, value: weis});

            (await crowdsale.tokensPurchased(buyer2))
            .should.be.bignumber.equal( tokens );

            (await crowdsale.tokensReferSenderBonus(buyer1))
            .should.be.bignumber.equal( _referSenderBonus );

            (await crowdsale.tokensReferReceiverBonus(buyer2))
            .should.be.bignumber.equal( _referReceiverBonus );

            (await crowdsale.balanceOf(buyer2))
            .should.be.bignumber.equal( tokens.plus(_referReceiverBonus) );

            (await crowdsale.balanceOf(buyer1))
            .should.be.bignumber.equal( _buyer1Balance.plus(_referSenderBonus) );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: pioneerWeiThreshold * rate * 2 + _referSenderBonus + _referReceiverBonus
         * - buyer1 (pioneer): pioneerWeiThreshold * rate * 2 + _referSenderBonus
         * - buyer2: 0.1 eth + _referReceiverBonus
        */
        it("should update totalSupply", async function () {
            (await crowdsale.totalSupply())
            .should.be.bignumber.equal( totalTokens );
        });

    });

    context('test pioneer bonus', function () {
        it("should deploy new contract", async function () {
            crowdsale = await Crowdsale.new(openingTime, closingTime, pioneerTimeEnd);
        });

        /* [Begin State]
         * crowdsale deployed
        */
        it("should buyer1 be able to pay weiRaisedPerStage * 3", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer1, value: weiRaisedPerStage.times(3)});
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * stage: 3
        */
        it("should buyer1 get bonus", async function () {
            let _bonus = pioneerBonusPerStage.times(3);

            (await crowdsale.currentStage())
            .should.be.bignumber.equal( 3 );

            (await crowdsale.calcPioneerBonus(buyer1))
            .should.be.bignumber.equal( _bonus );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * stage: 3
         * bonus designated:
         * - buyer1 (pioneer): pioneerBonusPerStage * 3
        */
        it("should buyer2 be able to pay weiRaisedPerStage * 2", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer2, value: weiRaisedPerStage.times(2)});
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * - buyer2 (pioneer): weiRaisedPerStage * rate * 2
         * stage: 3
         * bonus designated:
         * - buyer1 (pioneer): pioneerBonusPerStage * 3 + pioneerBonusPerStage * 3 / 5 * 2
         * - buyer2 (pioneer): pioneerBonusPerStage * 2 / 5 * 2
        */
        it("should buyer1 & buyer2 get bonus", async function () {
            let _bonus1 = pioneerBonusPerStage.times(3).plus(
                pioneerBonusPerStage.times(3).dividedToIntegerBy(5).times(2)
            );
            let _bonus2 = pioneerBonusPerStage.times(2).dividedToIntegerBy(5)
            .times(2);

            (await crowdsale.currentStage())
            .should.be.bignumber.equal( 5 );

            (await crowdsale.calcPioneerBonus(buyer1))
            .should.be.bignumber.equal( _bonus1 );

            (await crowdsale.calcPioneerBonus(buyer2))
            .should.be.bignumber.equal( _bonus2 );

            (_bonus1.add(_bonus2))
            .should.be.bignumber.equal(pioneerBonusPerStage.times(5));
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * - buyer2 (pioneer): weiRaisedPerStage * rate * 2
         * stage: 3
         * bonus designated:
         * - buyer1 (pioneer): pioneerBonusPerStage * 3 + pioneerBonusPerStage * 3 / 5 * 2
         * - buyer2 (pioneer): pioneerBonusPerStage * 2 / 5 * 2
        */
        it("should allow buyer3 be able to pay weiRaisedPerStage * 7", async function () {
            await crowdsale.purchaseTokens(anyone, {from: buyer3, value: weiRaisedPerStage.times(7)});
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * - buyer2 (pioneer): weiRaisedPerStage * rate * 2
         * - buyer3 (pioneer): weiRaisedPerStage * rate * 5
         * stage: 3
         * bonus designated:
         * - buyer1 (pioneer): pioneerBonusPerStage * 3 + pioneerBonusPerStage * 3 / 5 * 2 + pioneerBonusPerStage * 3 / 10 * 5
         * - buyer2 (pioneer): pioneerBonusPerStage * 2 / 5 * 2 + pioneerBonusPerStage * 2 / 10 * 5
         * - buyer3 (pioneer): pioneerBonusPerStage * 5 / 10 * 5
        */
        it("should buyer3 only pay weiRaisedPerStage * 5", async function () {
            (await crowdsale.weiRaisedFrom(buyer3))
            .should.be.bignumber.equal( weiRaisedPerStage.times(5) );

            (await crowdsale.totalWeiRaised.call())
            .should.be.bignumber.equal( weiRaisedPerStage.times(10) );
        });

        /* [Begin State]
         * crowdsale deployed
         * token purchased: weiRaisedPerStage * rate * 3
         * - buyer1 (pioneer): weiRaisedPerStage * rate * 3
         * - buyer2 (pioneer): weiRaisedPerStage * rate * 2
         * - buyer3 (pioneer): weiRaisedPerStage * rate * 5
         * stage: 3
         * bonus designated:
         * - buyer1 (pioneer): pioneerBonusPerStage * 3 + pioneerBonusPerStage * 3 / 5 * 2 + pioneerBonusPerStage * 3 / 10 * 5
         * - buyer2 (pioneer): pioneerBonusPerStage * 2 / 5 * 2 + pioneerBonusPerStage * 2 / 10 * 5
         * - buyer3 (pioneer): pioneerBonusPerStage * 5 / 10 * 5
        */
        it("should buyer1 & buyer2 & buyer3 get bonus", async function () {
            let _bonus1 = pioneerBonusPerStage.times(3).plus(
                pioneerBonusPerStage.times(3).dividedToIntegerBy(5).times(2)
            ).plus(
                pioneerBonusPerStage.times(3).dividedToIntegerBy(10).times(5)
            );

            let _bonus2 = pioneerBonusPerStage.times(2).dividedToIntegerBy(5)
            .times(2).plus(
                pioneerBonusPerStage.times(2).dividedToIntegerBy(10).times(5)
            );

            let _bonus3 = pioneerBonusPerStage.times(5).dividedToIntegerBy(10)
            .times(5);

            (await crowdsale.currentStage())
            .should.be.bignumber.equal( 10 );

            (await crowdsale.calcPioneerBonus(buyer1))
            .should.be.bignumber.equal( _bonus1 );

            (await crowdsale.calcPioneerBonus(buyer2))
            .should.be.bignumber.equal( _bonus2 );

            (await crowdsale.calcPioneerBonus(buyer3))
            .should.be.bignumber.equal( _bonus3 );

            (_bonus1.add(_bonus2).add(_bonus3))
            .should.be.bignumber.equal(pioneerBonusPerStage.times(10));
        });
    });
});
